import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { generateSpeechFromText, estimateAudioDuration, VoiceTone, VoiceSpeed, VoicePitch, VoiceAccent, SUPPORTED_VOICES, PronunciationRule } from './services/geminiService';
import { playBase64Audio, downloadAudioAsWav, getAudioDurationFromBase64, trimPcmAudio, splitPcmAudio, mergePcmAudios } from './services/audioUtils';
import Waveform from './components/Waveform';
import SpectrumIcon from './components/SpectrumIcon';
import EditorWaveform from './components/EditorWaveform';
import { Mic, Loader2, StopCircle, SlidersHorizontal, Gauge, Users, Clock, Timer, Sparkles, Download, Zap, PenTool, Highlighter, AudioLines, MapPin, ListMusic, Play, Pause, Trash2, Library, Keyboard, Hash, BookA, Plus, X, Scissors, Layers, CheckSquare, Square, Split, Save, HelpCircle, ArrowRightLeft, Bookmark, Dices, RotateCcw, Heart, GripVertical, Tag, AlertCircle } from 'lucide-react';

// Helper to safely get items from localStorage
const getStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

interface AudioClip {
  id: string;
  text: string;
  base64: string;
  duration: number;
  createdAt: number;
  isFavorite?: boolean;
  tag?: 'A' | 'B' | 'C' | 'D';
  settings: {
    tone: VoiceTone;
    speed: VoiceSpeed;
    pitch: VoicePitch;
    voiceId: string;
    accent: VoiceAccent;
    customStyle?: string;
    seed?: number;
    pronunciationRules?: PronunciationRule[];
  };
}

interface SavedPreset {
    id: string;
    name: string;
    settings: {
        tone: VoiceTone;
        speed: VoiceSpeed;
        pitch: VoicePitch;
        voiceId: string;
        accent: VoiceAccent;
        isProMode: boolean;
        customStyle: string;
    };
}

// --- Components ---

const InfoTooltip: React.FC<{ content: string }> = ({ content }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-flex items-center ml-1.5" 
         onMouseEnter={() => setIsVisible(true)} 
         onMouseLeave={() => setIsVisible(false)}
         onClick={() => setIsVisible(!isVisible)}
    >
      <HelpCircle size={14} className="text-slate-400 cursor-help hover:text-rose-500 transition-colors" />
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          {content}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  // Initialize state from localStorage or use defaults
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<VoiceTone>(() => getStorageItem('settings_tone', 'soft'));
  const [selectedSpeed, setSelectedSpeed] = useState<VoiceSpeed>(() => getStorageItem('settings_speed', 'normal'));
  const [selectedPitch, setSelectedPitch] = useState<VoicePitch>(() => getStorageItem('settings_pitch', 'normal'));
  const [selectedAccent, setSelectedAccent] = useState<VoiceAccent>(() => getStorageItem('settings_accent', 'standard'));
  const [selectedVoice, setSelectedVoice] = useState<string>(() => getStorageItem('settings_voice', 'kore_base')); // Store Profile ID
  const [maxDuration, setMaxDuration] = useState<number | null>(() => getStorageItem('settings_duration', null));
  
  // Pro Mode States
  const [isProMode, setIsProMode] = useState(() => getStorageItem('settings_isProMode', false));
  const [customStyle, setCustomStyle] = useState(() => getStorageItem('settings_customStyle', ''));
  const [seed, setSeed] = useState<number | ''>(''); // User input for seed
  
  // Pronunciation Rules State
  const [pronunciationRules, setPronunciationRules] = useState<PronunciationRule[]>(() => getStorageItem('settings_pronunciationRules', []));
  const [newRuleOriginal, setNewRuleOriginal] = useState('');
  const [newRuleReplacement, setNewRuleReplacement] = useState('');

  // Audio Library State
  const [audioLibrary, setAudioLibrary] = useState<AudioClip[]>(() => getStorageItem('audio_library', []));
  const [activeTab, setActiveTab] = useState<'settings' | 'library'>('settings');

  // Presets State
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => getStorageItem('settings_presets', []));
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // Editing State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [editingClip, setEditingClip] = useState<AudioClip | null>(null);
  const [editTab, setEditTab] = useState<'trim' | 'split'>('trim');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [tagPopoverId, setTagPopoverId] = useState<string | null>(null);
  
  // A/B Compare State
  const [compareClips, setCompareClips] = useState<[AudioClip, AudioClip] | null>(null);
  
  // Edit Values
  const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
  const [splitTime, setSplitTime] = useState(0);

  // Playback State
  const [currentClipId, setCurrentClipId] = useState<string | null>(null);
  const [actualDuration, setActualDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Use state for analyser to trigger re-renders for Waveform
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceListRef = useRef<HTMLDivElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('settings_tone', JSON.stringify(selectedTone));
    localStorage.setItem('settings_speed', JSON.stringify(selectedSpeed));
    localStorage.setItem('settings_pitch', JSON.stringify(selectedPitch));
    localStorage.setItem('settings_accent', JSON.stringify(selectedAccent));
    localStorage.setItem('settings_voice', JSON.stringify(selectedVoice));
    localStorage.setItem('settings_duration', JSON.stringify(maxDuration));
    localStorage.setItem('settings_isProMode', JSON.stringify(isProMode));
    localStorage.setItem('settings_customStyle', JSON.stringify(customStyle));
    localStorage.setItem('settings_pronunciationRules', JSON.stringify(pronunciationRules));
  }, [selectedTone, selectedSpeed, selectedPitch, selectedAccent, selectedVoice, maxDuration, isProMode, customStyle, pronunciationRules]);

  // Persist library & presets
  useEffect(() => {
    localStorage.setItem('audio_library', JSON.stringify(audioLibrary));
  }, [audioLibrary]);

  useEffect(() => {
    localStorage.setItem('settings_presets', JSON.stringify(savedPresets));
  }, [savedPresets]);

  // Scroll selected voice into view when it changes
  useEffect(() => {
    if (activeTab === 'settings' && voiceListRef.current) {
        const selectedEl = voiceListRef.current.querySelector(`[data-voice-id="${selectedVoice}"]`);
        if (selectedEl) {
            selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [selectedVoice, activeTab]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setActualDuration(null);
    if (error) setError(null);
  };

  const handleEmphasize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) return; // No selection

    const text = inputText;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    // Simple wrap with asterisks
    const newText = `${before}*${selected}*${after}`;
    setInputText(newText);
    setActualDuration(null);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, end + 2); // +2 covers the added asterisks
    }, 0);
  };

  const handleAddRule = () => {
    if (newRuleOriginal.trim() && newRuleReplacement.trim()) {
      setPronunciationRules([...pronunciationRules, { original: newRuleOriginal.trim(), replacement: newRuleReplacement.trim() }]);
      setNewRuleOriginal('');
      setNewRuleReplacement('');
    }
  };

  const handleDeleteRule = (index: number) => {
    setPronunciationRules(pronunciationRules.filter((_, i) => i !== index));
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    // Apply the voice's default pitch automatically for better UX
    const profile = SUPPORTED_VOICES.find(v => v.id === voiceId);
    if (profile) {
      setSelectedPitch(profile.defaultPitch);
    }
  };

  // Preset Handlers
  const handleSavePreset = () => {
      if (!newPresetName.trim()) return;
      
      const newPreset: SavedPreset = {
          id: Date.now().toString(),
          name: newPresetName.trim(),
          settings: {
              tone: selectedTone,
              speed: selectedSpeed,
              pitch: selectedPitch,
              voiceId: selectedVoice,
              accent: selectedAccent,
              isProMode: isProMode,
              customStyle: customStyle
          }
      };
      
      setSavedPresets(prev => [...prev, newPreset]);
      setNewPresetName('');
      setIsSavingPreset(false);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
      setSelectedTone(preset.settings.tone);
      setSelectedSpeed(preset.settings.speed);
      setSelectedPitch(preset.settings.pitch);
      setSelectedVoice(preset.settings.voiceId);
      setSelectedAccent(preset.settings.accent);
      setIsProMode(preset.settings.isProMode);
      setCustomStyle(preset.settings.customStyle);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSavedPresets(prev => prev.filter(p => p.id !== id));
  };

  const handleRandomize = () => {
      const randomVoice = SUPPORTED_VOICES[Math.floor(Math.random() * SUPPORTED_VOICES.length)];
      const randomTone = ['soft', 'cheerful', 'calm', 'firm'][Math.floor(Math.random() * 4)] as VoiceTone;
      const randomPitch = ['low', 'normal', 'high'][Math.floor(Math.random() * 3)] as VoicePitch;
      const randomSpeed = ['slow', 'normal', 'fast'][Math.floor(Math.random() * 3)] as VoiceSpeed;
      
      setSelectedVoice(randomVoice.id);
      setSelectedTone(randomTone);
      setSelectedPitch(randomPitch);
      setSelectedSpeed(randomSpeed);
      // Reset others
      setSelectedAccent('standard');
      setIsProMode(false);
  };
  
  const handleResetSettings = () => {
      setSelectedVoice('kore_base');
      setSelectedTone('soft');
      setSelectedPitch('normal');
      setSelectedSpeed('normal');
      setSelectedAccent('standard');
      setCustomStyle('');
      setSeed('');
  };

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        // Prevent onended from triggering state reset if we are manually stopping
        audioSourceRef.current.onended = null;
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      audioSourceRef.current = null;
    }
    // Clean up AudioContext explicitly to avoid leaks and overlaps
    if (audioContextRef.current) {
        try {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        } catch (e) {
            // Ignore
        }
        audioContextRef.current = null;
    }
    
    setAnalyserNode(null);
    setIsPlaying(false);
    setCurrentClipId(null);
  }, []);

  const playAudioData = async (base64String: string, clipId: string | null = null) => {
    stopAudio();
    setIsPlaying(true);
    setCurrentClipId(clipId);
    try {
      const { source, analyser, audioContext } = await playBase64Audio(base64String, () => {
        setIsPlaying(false);
        setCurrentClipId(null);
      });
      audioSourceRef.current = source;
      audioContextRef.current = audioContext;
      setAnalyserNode(analyser);
    } catch (e) {
      console.error("Playback error", e);
      setIsPlaying(false);
      setCurrentClipId(null);
      setAnalyserNode(null);
    }
  };

  const handleGenerateAndPlay = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);
    setActualDuration(null);
    stopAudio();

    // Use user provided seed or generate a random one for reproducibility
    const currentSeed = seed !== '' ? Number(seed) : Math.floor(Math.random() * 1000000);

    try {
      const base64Audio = await generateSpeechFromText(
        inputText,
        selectedTone,
        selectedSpeed,
        selectedPitch,
        selectedVoice,
        maxDuration,
        isProMode ? customStyle : '',
        selectedAccent,
        currentSeed,
        isProMode ? pronunciationRules : []
      );

      if (base64Audio) {
        // Calculate duration immediately
        const duration = await getAudioDurationFromBase64(base64Audio);
        setActualDuration(duration);

        // Add to Library
        const newClip: AudioClip = {
            id: Date.now().toString(),
            text: inputText,
            base64: base64Audio,
            duration: duration,
            createdAt: Date.now(),
            settings: {
                tone: selectedTone,
                speed: selectedSpeed,
                pitch: selectedPitch,
                voiceId: selectedVoice,
                accent: selectedAccent,
                customStyle: isProMode ? customStyle : undefined,
                seed: currentSeed,
                pronunciationRules: isProMode ? pronunciationRules : undefined
            }
        };
        setAudioLibrary(prev => [newClip, ...prev]);

        // Play
        await playAudioData(base64Audio, newClip.id);
      }
    } catch (err) {
      console.error(err);
      setError("음성 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // Library Handlers
  const handlePlayClip = (clip: AudioClip) => {
    if (currentClipId === clip.id && isPlaying) {
        stopAudio();
    } else {
        setActualDuration(clip.duration);
        playAudioData(clip.base64, clip.id);
    }
  };

  const promptDeleteClip = (id: string) => {
      setDeleteConfirmId(id);
  };

  const confirmDeleteClip = () => {
      if (!deleteConfirmId) return;
      
      const id = deleteConfirmId;
      if (currentClipId === id) stopAudio();
      
      setAudioLibrary(prev => prev.filter(c => c.id !== id));
      if (selectedClipIds.has(id)) {
          const next = new Set(selectedClipIds);
          next.delete(id);
          setSelectedClipIds(next);
      }
      setDeleteConfirmId(null);
  };

  const cancelDeleteClip = () => {
      setDeleteConfirmId(null);
  };

  const handleApplySeed = (clipSeed?: number) => {
      if (clipSeed !== undefined) {
          setIsProMode(true);
          setSeed(clipSeed);
          setActiveTab('settings');
      }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setAudioLibrary(prev => prev.map(clip => 
          clip.id === id ? { ...clip, isFavorite: !clip.isFavorite } : clip
      ));
  };

  const updateTag = (id: string, tag: 'A' | 'B' | 'C' | 'D' | undefined) => {
      setAudioLibrary(prev => prev.map(clip => 
          clip.id === id ? { ...clip, tag: tag === clip.tag ? undefined : tag } : clip
      ));
      setTagPopoverId(null);
  };

  // --- Drag and Drop Logic ---

  const moveAudioClip = (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const copyListItems = [...audioLibrary];
      const draggedItemContent = copyListItems[fromIndex];
      copyListItems.splice(fromIndex, 1);
      copyListItems.splice(toIndex, 0, draggedItemContent);
      setAudioLibrary(copyListItems);
  };

  // Desktop Drag Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50');
    if (dragItem.current !== null && dragOverItem.current !== null) {
        moveAudioClip(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Mobile Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
      dragItem.current = index;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (dragItem.current === null) return;
      
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = target?.closest('[data-index]');
      
      if (row) {
          const targetIndex = parseInt(row.getAttribute('data-index') || '-1');
          if (targetIndex !== -1 && targetIndex !== dragItem.current) {
               // Move immediately for feedback
               moveAudioClip(dragItem.current, targetIndex);
               dragItem.current = targetIndex; // Update dragged index to current position
          }
      }
  };

  const handleTouchEnd = () => {
      dragItem.current = null;
  };

  // Selection & Merging
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedClipIds(new Set());
  };

  const toggleClipSelection = (id: string) => {
    const next = new Set(selectedClipIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedClipIds(next);
  };

  const handleMergeSelected = async () => {
      if (selectedClipIds.size < 2) return;
      
      const clipsToMerge = audioLibrary
          .filter(c => selectedClipIds.has(c.id))
          // Preserve library order for merging
          .sort((a, b) => audioLibrary.indexOf(a) - audioLibrary.indexOf(b));

      const mergedBase64 = mergePcmAudios(clipsToMerge.map(c => c.base64));
      const duration = await getAudioDurationFromBase64(mergedBase64);
      
      const mergedClip: AudioClip = {
          id: Date.now().toString(),
          text: `Merged: ${clipsToMerge.map(c => c.text.substring(0, 10)).join(', ')}...`,
          base64: mergedBase64,
          duration: duration,
          createdAt: Date.now(),
          settings: { ...clipsToMerge[0].settings } // Inherit settings from first clip
      };
      
      setAudioLibrary(prev => [mergedClip, ...prev]);
      setIsSelectionMode(false);
      setSelectedClipIds(new Set());
  };

  const handlePlayLibrarySelection = async () => {
    if (selectedClipIds.size === 0) return;
    
    const clipsToPlay = audioLibrary
        .filter(c => selectedClipIds.has(c.id))
        .sort((a, b) => audioLibrary.indexOf(a) - audioLibrary.indexOf(b));

    if (clipsToPlay.length === 0) return;

    if (clipsToPlay.length === 1) {
        handlePlayClip(clipsToPlay[0]);
        return;
    }

    setIsLoading(true);
    try {
        const mergedBase64 = mergePcmAudios(clipsToPlay.map(c => c.base64));
        const duration = await getAudioDurationFromBase64(mergedBase64);
        setActualDuration(duration);
        await playAudioData(mergedBase64, 'merged_playback');
    } catch (e) {
        console.error("Playback failed", e);
        setError("재생 실패");
    } finally {
        setIsLoading(false);
    }
  };

  const handleCompareSelected = () => {
    if (selectedClipIds.size !== 2) return;
    const selected = audioLibrary.filter(c => selectedClipIds.has(c.id));
    if (selected.length === 2) {
      setCompareClips([selected[0], selected[1]]);
    }
  };

  // Edit Handlers
  const openEditor = (clip: AudioClip) => {
      stopAudio();
      setEditingClip(clip);
      setTrimRange({ start: 0, end: clip.duration });
      setSplitTime(clip.duration / 2);
  };

  const closeEditor = () => {
      stopAudio();
      setEditingClip(null);
  };

  const handleTrimSave = async () => {
      if (!editingClip) return;
      const trimmedBase64 = trimPcmAudio(editingClip.base64, trimRange.start, trimRange.end);
      if (!trimmedBase64) return;
      
      const duration = await getAudioDurationFromBase64(trimmedBase64);
      const newClip: AudioClip = {
          ...editingClip,
          id: Date.now().toString(),
          text: `Trimmed: ${editingClip.text}`,
          base64: trimmedBase64,
          duration: duration,
          createdAt: Date.now()
      };
      
      setAudioLibrary(prev => [newClip, ...prev]);
      closeEditor();
  };

  const handleSplitSave = async () => {
      if (!editingClip) return;
      const [part1, part2] = splitPcmAudio(editingClip.base64, splitTime);
      
      const d1 = await getAudioDurationFromBase64(part1);
      const d2 = await getAudioDurationFromBase64(part2);
      
      const clip1: AudioClip = {
          ...editingClip,
          id: (Date.now()).toString(),
          text: `Split 1: ${editingClip.text}`,
          base64: part1,
          duration: d1,
          createdAt: Date.now()
      };
      
      const clip2: AudioClip = {
          ...editingClip,
          id: (Date.now() + 1).toString(),
          text: `Split 2: ${editingClip.text}`,
          base64: part2,
          duration: d2,
          createdAt: Date.now()
      };
      
      setAudioLibrary(prev => [clip1, clip2, ...prev]);
      closeEditor();
  };
  
  const previewTrim = () => {
      if (!editingClip) return;
      const trimmed = trimPcmAudio(editingClip.base64, trimRange.start, trimRange.end);
      playAudioData(trimmed, 'preview_trim');
  };
  
  const previewSplit1 = () => {
       if (!editingClip) return;
       const [p1] = splitPcmAudio(editingClip.base64, splitTime);
       playAudioData(p1, 'preview_split_1');
  };
  
  const previewSplit2 = () => {
       if (!editingClip) return;
       const [, p2] = splitPcmAudio(editingClip.base64, splitTime);
       playAudioData(p2, 'preview_split_2');
  };

  // Keyboard Shortcuts
  const handleTextAreaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+B for Emphasis
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleEmphasize();
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        // Allow Escape in inputs to close editors
        if (isInput && e.code !== 'Escape') return;

        // --- Editor Mode Shortcuts ---
        if (editingClip) {
            e.stopPropagation(); // prevent bubbling

            switch (e.code) {
                case 'Escape':
                    e.preventDefault();
                    closeEditor();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (editTab === 'trim') handleTrimSave();
                    else handleSplitSave();
                    break;
                case 'Space':
                    e.preventDefault();
                    if (isPlaying) {
                        stopAudio();
                    } else {
                        if (editTab === 'trim') previewTrim();
                        else previewSplit1();
                    }
                    break;
            }
            return;
        }

        if (isInput) return; // Standard shortcuts don't fire while typing

        // --- Main App Shortcuts ---
        switch (e.code) {
            case 'ArrowLeft': {
                e.preventDefault();
                const currentIndex = SUPPORTED_VOICES.findIndex(v => v.id === selectedVoice);
                const prevIndex = (currentIndex - 1 + SUPPORTED_VOICES.length) % SUPPORTED_VOICES.length;
                handleVoiceSelect(SUPPORTED_VOICES[prevIndex].id);
                break;
            }
            case 'ArrowRight': {
                e.preventDefault();
                const currentIndex = SUPPORTED_VOICES.findIndex(v => v.id === selectedVoice);
                const nextIndex = (currentIndex + 1) % SUPPORTED_VOICES.length;
                handleVoiceSelect(SUPPORTED_VOICES[nextIndex].id);
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                // Speed: Slow -> Normal -> Fast
                if (selectedSpeed === 'slow') setSelectedSpeed('normal');
                else if (selectedSpeed === 'normal') setSelectedSpeed('fast');
                break;
            }
            case 'ArrowDown': {
                e.preventDefault();
                // Speed: Fast -> Normal -> Slow
                if (selectedSpeed === 'fast') setSelectedSpeed('normal');
                else if (selectedSpeed === 'normal') setSelectedSpeed('slow');
                break;
            }
            case 'Space': {
                e.preventDefault();
                if (isPlaying) {
                    stopAudio();
                } else if (!isLoading && !editingClip) {
                    if (activeTab === 'library') {
                        handlePlayLibrarySelection();
                    } else {
                        handleGenerateAndPlay();
                    }
                }
                break;
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedVoice, selectedSpeed, isPlaying, isLoading, inputText, selectedTone, selectedPitch, selectedAccent, maxDuration, isProMode, customStyle, seed, pronunciationRules, editingClip, editTab, trimRange, splitTime, audioLibrary, activeTab, selectedClipIds]);


  // Calculate Estimated Duration (visual only)
  const estimatedDuration = useMemo(() => estimateAudioDuration(inputText, selectedSpeed), [inputText, selectedSpeed]);
  
  // 30s Limit Check
  const isOverDurationLimit = estimatedDuration > 30;

  const isActionDisabled = isLoading || 
    (activeTab === 'settings' && (!inputText.trim() || isOverDurationLimit)) || 
    (activeTab === 'library' && selectedClipIds.size === 0);

  // Group Library items
  const favoriteClips = audioLibrary.filter(clip => clip.isFavorite);
  const regularClips = audioLibrary.filter(clip => !clip.isFavorite);
  
  // Tag Colors
  const tagColors = {
      'A': 'bg-red-500',
      'B': 'bg-blue-500',
      'C': 'bg-green-500',
      'D': 'bg-amber-500'
  };

  const renderClipItem = (clip: AudioClip, index: number, isRegularList: boolean) => (
      <div 
        key={clip.id}
        data-index={index}
        draggable={isRegularList} // Only allow dragging in main list for simplicity in this version
        onDragStart={(e) => handleDragStart(e, index)}
        onDragEnter={(e) => handleDragEnter(e, index)}
        onDragEnd={handleDragEnd}
        className={`bg-white p-4 rounded-xl border transition-all relative group/item select-none
          ${currentClipId === clip.id ? 'border-rose-400 ring-1 ring-rose-100 shadow-md' : 'border-slate-200 shadow-sm hover:border-rose-200'}
          ${isSelectionMode ? 'pl-3' : ''}
          ${isRegularList ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
      >
        {/* Tag Badge */}
        {clip.tag && (
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white ${tagColors[clip.tag]}`} />
        )}

        <div className="flex gap-4 items-center">
            {/* Drag Handle */}
            {isRegularList && !isSelectionMode && (
                 <div 
                    className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 cursor-grab p-2 touch-none"
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                 >
                    <GripVertical size={16} />
                 </div>
            )}

            {isSelectionMode && (
                <button onClick={() => toggleClipSelection(clip.id)} className="text-slate-400 hover:text-rose-500">
                    {selectedClipIds.has(clip.id) ? <CheckSquare className="text-rose-500" /> : <Square />}
                </button>
            )}
            
            {/* Spectrogram Icon */}
            <div className="flex-none relative ml-4">
                <SpectrumIcon base64Data={clip.base64} width={48} height={48} className="border border-slate-100" />
                {clip.tag && (
                    <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${tagColors[clip.tag]} ring-1 ring-white`} />
                )}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm text-slate-800 font-medium line-clamp-2 pr-2">{clip.text}</p>
                    {!isSelectionMode && (
                        <div className="flex gap-1">
                             <button 
                                onClick={(e) => toggleFavorite(clip.id, e)} 
                                className={`p-1 hover:scale-110 transition-transform ${clip.isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                                title="즐겨찾기"
                             >
                                <Heart size={14} fill={clip.isFavorite ? "currentColor" : "none"} />
                             </button>
                             <div className="relative">
                                <button 
                                    onClick={() => setTagPopoverId(tagPopoverId === clip.id ? null : clip.id)}
                                    className={`p-1 hover:text-indigo-500 ${clip.tag ? 'text-indigo-500' : 'text-slate-300'}`}
                                    title="태그"
                                >
                                    <Tag size={14} fill={clip.tag ? "currentColor" : "none"} />
                                </button>
                                {tagPopoverId === clip.id && (
                                    <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-1.5 flex gap-1 z-10 animate-in fade-in zoom-in-95">
                                        {(['A', 'B', 'C', 'D'] as const).map(tag => (
                                            <button 
                                                key={tag} 
                                                onClick={() => updateTag(clip.id, tag)}
                                                className={`w-4 h-4 rounded-full ${tagColors[tag]} hover:scale-110 transition-transform ${clip.tag === tag ? 'ring-2 ring-slate-400' : ''}`} 
                                            />
                                        ))}
                                        <button onClick={() => updateTag(clip.id, undefined)} className="text-[10px] text-slate-400 px-1 hover:text-red-500">❌</button>
                                    </div>
                                )}
                             </div>
                             <div className="w-px h-3 bg-slate-200 mx-1 self-center" />
                             <button onClick={() => openEditor(clip)} className="text-slate-300 hover:text-blue-500 p-1" title="편집">
                                <Scissors size={14} />
                            </button>
                            <button onClick={() => promptDeleteClip(clip.id)} className="text-slate-300 hover:text-rose-500 p-1 flex-none" title="삭제">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Active Clip Visualizer */}
                {currentClipId === clip.id && isPlaying && (
                    <div className="mb-3 h-8 w-full bg-rose-50 rounded-lg overflow-hidden relative border border-rose-100">
                        <Waveform isPlaying={true} analyser={analyserNode} />
                    </div>
                )}

                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">{new Date(clip.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">{clip.duration.toFixed(1)}s</span>
                        {clip.settings.voiceId && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{SUPPORTED_VOICES.find(v => v.id === clip.settings.voiceId)?.label || 'Merged'}</span>}
                    </div>
                    {!isSelectionMode && (
                        <div className="flex items-center gap-2">
                            {isProMode && (
                                <button 
                                    onClick={() => downloadAudioAsWav(clip.base64, `speech-${clip.id}.wav`)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full"
                                    title="다운로드"
                                >
                                    <Download size={14} />
                                </button>
                            )}
                            <button 
                                onClick={() => handlePlayClip(clip)}
                                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${currentClipId === clip.id && isPlaying ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {currentClipId === clip.id && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Visualizer Background (Fixed) */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
         <Waveform isPlaying={isPlaying && !editingClip} analyser={analyserNode} />
      </div>

      {/* Header */}
      <header className="flex-none bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 z-10 sticky top-0">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-500">
            <AudioLines size={28} />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Korean Soft TTS <span className="text-xs font-normal text-slate-400 ml-1">v2.0</span></h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1 pr-3">
                <button
                    onClick={() => setIsProMode(!isProMode)}
                    className={`p-1.5 rounded-full transition-all ${isProMode ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Zap size={16} fill={isProMode ? "currentColor" : "none"} />
                </button>
                <span className={`text-xs font-medium ${isProMode ? 'text-rose-600' : 'text-slate-500'}`}>
                    {isProMode ? 'Pro Mode' : 'Standard'}
                </span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto z-10">
        <div className="max-w-xl mx-auto p-4 space-y-4 pb-40">
            
            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-lg">
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <SlidersHorizontal size={16} /> 설정 & 입력
                </button>
                <button 
                    onClick={() => setActiveTab('library')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'library' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Library size={16} /> 
                    라이브러리 
                    {audioLibrary.length > 0 && <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[10px]">{audioLibrary.length}</span>}
                </button>
            </div>

            {activeTab === 'settings' ? (
                <>
                  {/* Presets & Randomize Section */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
                      <button 
                         onClick={handleRandomize}
                         className="flex-none bg-indigo-50 text-indigo-500 hover:bg-indigo-100 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border border-indigo-100 transition-colors"
                      >
                         <Dices size={14} /> 랜덤 추천
                      </button>
                      <button 
                         onClick={handleResetSettings}
                         className="flex-none bg-slate-50 text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border border-slate-100 transition-colors"
                      >
                         <RotateCcw size={14} /> 초기화
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
                      
                      {savedPresets.map(preset => (
                          <div key={preset.id} className="flex-none group flex items-center gap-1 bg-white border border-slate-200 pl-3 pr-1 py-0.5 rounded-full text-xs text-slate-600 shadow-sm cursor-pointer hover:border-rose-300">
                             <span onClick={() => handleLoadPreset(preset)}>{preset.name}</span>
                             <button onClick={(e) => handleDeletePreset(preset.id, e)} className="p-1 hover:text-red-500 text-slate-300 rounded-full"><X size={12} /></button>
                          </div>
                      ))}
                      
                      {isSavingPreset ? (
                          <div className="flex-none flex items-center gap-1 bg-white border border-rose-200 p-0.5 pl-2 rounded-full animate-in fade-in slide-in-from-left-2">
                             <input 
                                autoFocus
                                value={newPresetName} 
                                onChange={(e) => setNewPresetName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
                                placeholder="프리셋 이름"
                                className="w-24 text-xs outline-none bg-transparent"
                             />
                             <button onClick={handleSavePreset} className="bg-rose-500 text-white rounded-full p-1"><Plus size={12} /></button>
                             <button onClick={() => setIsSavingPreset(false)} className="text-slate-400 p-1"><X size={12} /></button>
                          </div>
                      ) : (
                          <button 
                            onClick={() => setIsSavingPreset(true)}
                            className="flex-none bg-slate-100 text-slate-500 hover:bg-slate-200 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border border-slate-200 border-dashed"
                          >
                            <Bookmark size={12} /> 설정 저장
                          </button>
                      )}
                  </div>

                  {/* Text Input Area */}
                  <div className={`rounded-2xl shadow-sm border overflow-hidden relative group focus-within:ring-2 focus-within:ring-rose-100 transition-all ${
                        isProMode 
                            ? 'bg-gradient-to-br from-white to-rose-50/30 border-rose-200 ring-1 ring-rose-100' 
                            : 'bg-white border-slate-200'
                    }`}>
                    <div className="absolute top-3 right-3 flex gap-1 z-20">
                         <button 
                            onClick={handleEmphasize}
                            title="강조하기 (Ctrl+B)"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                         >
                            <Highlighter size={16} />
                         </button>
                    </div>
                    <textarea 
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleTextChange}
                      onKeyDown={handleTextAreaKeyDown}
                      placeholder={isProMode ? "변환할 한글 텍스트를 입력하세요...\n\n(Tip: *강조할 부분*은 별표로 감싸주세요)" : "여기에 텍스트를 입력하면 부드러운 목소리로 읽어줍니다."}
                      className="w-full h-40 p-5 text-lg text-slate-700 placeholder:text-slate-300 resize-none outline-none bg-transparent leading-relaxed custom-scrollbar"
                    />
                    
                    {/* Duration Badge */}
                    <div className="absolute bottom-4 right-4 transition-all duration-300">
                        {actualDuration !== null ? (
                            <div className="flex items-center gap-1.5 bg-rose-500 text-white px-3 py-1.5 rounded-full shadow-md animate-in fade-in zoom-in duration-300">
                                <Clock size={14} />
                                <span className="text-sm font-bold">{actualDuration.toFixed(1)}s</span>
                            </div>
                        ) : inputText.length > 0 ? (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors duration-200 ${
                                isOverDurationLimit 
                                    ? 'bg-red-100 text-red-600 animate-pulse ring-1 ring-red-200' 
                                    : 'bg-slate-100 text-slate-500'
                            }`}>
                                {isOverDurationLimit ? <AlertCircle size={14} /> : <Timer size={14} />}
                                <span className="text-xs font-medium">
                                    {isOverDurationLimit ? `제한 초과 (약 ${estimatedDuration.toFixed(0)}초)` : `약 ${estimatedDuration.toFixed(0)}초`}
                                </span>
                            </div>
                        ) : null}
                    </div>
                  </div>

                  {/* Settings Panel */}
                  <div className="space-y-4">
                    
                    {/* Voice Selection */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-500">
                            <Users size={16} />
                            <span>목소리 캐릭터</span>
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 ml-auto">⬅️ ➡️</span>
                        </div>
                        <div 
                            ref={voiceListRef}
                            className="flex gap-4 overflow-x-auto py-6 px-[calc(50%-3rem)] scrollbar-hide snap-x snap-mandatory"
                        >
                            {SUPPORTED_VOICES.map((voice) => (
                                <button
                                    key={voice.id}
                                    data-voice-id={voice.id}
                                    onClick={() => handleVoiceSelect(voice.id)}
                                    className={`flex-none w-24 snap-center flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                                        selectedVoice === voice.id
                                            ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200 scale-110 shadow-lg z-10'
                                            : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white scale-100'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${selectedVoice === voice.id ? 'bg-white' : 'bg-slate-200 grayscale'}`}>
                                        {voice.gender === '여성' ? '👩' : '👨'}
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-bold ${selectedVoice === voice.id ? 'text-slate-800' : 'text-slate-500'}`}>{voice.label}</div>
                                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{voice.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pro Mode: Custom Style & Seed & Pronunciation Input */}
                    {isProMode ? (
                        <div className="space-y-3">
                             {/* Custom Style */}
                             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                 <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-500">
                                    <PenTool size={16} />
                                    <span>커스텀 스타일 지시 (Pro)</span>
                                    <InfoTooltip content="AI에게 원하는 말하기 톤을 구체적으로 설명해주세요. 예: '뉴스 앵커처럼 정확하게', '동화책 읽듯이 실감나게', '비밀을 말하듯 속삭이며'." />
                                 </div>
                                 <input 
                                    type="text"
                                    value={customStyle}
                                    onChange={(e) => setCustomStyle(e.target.value)}
                                    placeholder="예: 뉴스 앵커처럼 정확하게, 동화책 읽듯이..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 transition-colors"
                                 />
                             </div>
                             
                             {/* Seed */}
                             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                 <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-500">
                                    <Hash size={16} />
                                    <span>Seed (일관성 고정)</span>
                                    <InfoTooltip content="Seed 값을 고정하면 매번 똑같은 톤과 억양으로 생성됩니다. 마음에 드는 결과물이 나오면 Seed를 저장해두세요." />
                                 </div>
                                 <div className="flex gap-2">
                                     <input 
                                        type="number"
                                        value={seed}
                                        onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="랜덤 (비워두면 자동 생성)"
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 transition-colors"
                                     />
                                     <button 
                                        onClick={() => setSeed('')}
                                        className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500"
                                     >
                                        초기화
                                     </button>
                                 </div>
                                 <p className="text-[10px] text-slate-400 mt-1.5">
                                    * 같은 Seed를 사용하면 동일한 설정에서 항상 같은 결과가 생성됩니다.
                                 </p>
                             </div>

                             {/* Pronunciation Dictionary */}
                             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-500">
                                    <BookA size={16} />
                                    <span>발음 교정 사전</span>
                                    <InfoTooltip content="특정 단어를 원하는 대로 발음하게 교정합니다. 주로 영어 약어, 고유명사, 신조어 등에 유용합니다." />
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <input 
                                        type="text" 
                                        value={newRuleOriginal}
                                        onChange={(e) => setNewRuleOriginal(e.target.value)}
                                        placeholder="단어 (예: ChatGPT)"
                                        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                                    />
                                    <span className="self-center text-slate-400">➡</span>
                                    <input 
                                        type="text" 
                                        value={newRuleReplacement}
                                        onChange={(e) => setNewRuleReplacement(e.target.value)}
                                        placeholder="발음 (예: 챗지피티)"
                                        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                                        onKeyDown={(e) => { if(e.key === 'Enter') handleAddRule() }}
                                    />
                                    <button 
                                        onClick={handleAddRule}
                                        disabled={!newRuleOriginal.trim() || !newRuleReplacement.trim()}
                                        className="px-2 py-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg disabled:opacity-50"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {pronunciationRules.length === 0 ? (
                                        <p className="text-[10px] text-slate-400 w-full text-center py-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                            등록된 교정 규칙이 없습니다.
                                        </p>
                                    ) : (
                                        pronunciationRules.map((rule, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[11px] text-slate-600">
                                                <span className="font-medium text-slate-800">{rule.original}</span>
                                                <span className="text-slate-400 text-[9px]">➡</span>
                                                <span>{rule.replacement}</span>
                                                <button 
                                                    onClick={() => handleDeleteRule(idx)}
                                                    className="ml-1 text-slate-400 hover:text-red-500"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                             </div>
                        </div>
                    ) : (
                        /* Standard Mode: Tone Selection */
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-500">
                                <Sparkles size={16} />
                                <span>말하기 스타일</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'soft', label: '부드럽게', icon: '🍃' },
                                    { id: 'cheerful', label: '밝게', icon: '☀️' },
                                    { id: 'calm', label: '차분하게', icon: '☕' },
                                    { id: 'firm', label: '단호하게', icon: '👔' }
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => setSelectedTone(option.id as VoiceTone)}
                                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                                            selectedTone === option.id
                                                ? 'bg-rose-500 text-white shadow-md transform scale-[1.02]'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <span className="block text-base mb-1">{option.icon}</span>
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Controls Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Speed Control */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-2 text-xs font-medium text-slate-500">
                                <div className="flex items-center gap-1"><Gauge size={14} /> 속도 <span className="text-[9px] bg-slate-100 px-1 rounded ml-1">⬆️ ⬇️</span></div>
                             </div>
                             <div className="flex bg-slate-100 rounded-lg p-1">
                                {(['slow', 'normal', 'fast'] as VoiceSpeed[]).map((speed) => (
                                    <button
                                        key={speed}
                                        onClick={() => setSelectedSpeed(speed)}
                                        className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                                            selectedSpeed === speed ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {speed === 'slow' ? '느리게' : speed === 'normal' ? '보통' : '빠르게'}
                                    </button>
                                ))}
                             </div>
                        </div>

                        {/* Pitch Control */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-2 text-xs font-medium text-slate-500">
                                <div className="flex items-center gap-1"><AudioLines size={14} /> 톤/높이</div>
                             </div>
                             <div className="flex bg-slate-100 rounded-lg p-1">
                                {(['low', 'normal', 'high'] as VoicePitch[]).map((pitch) => (
                                    <button
                                        key={pitch}
                                        onClick={() => setSelectedPitch(pitch)}
                                        className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                                            selectedPitch === pitch ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {pitch === 'low' ? '낮게' : pitch === 'normal' ? '보통' : '높게'}
                                    </button>
                                ))}
                             </div>
                        </div>

                        {/* Accent Control */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-2 text-xs font-medium text-slate-500">
                                <div className="flex items-center gap-1"><MapPin size={14} /> 억양/사투리</div>
                             </div>
                             <div className="flex bg-slate-100 rounded-lg p-1">
                                {(['standard', 'busan', 'jeolla'] as VoiceAccent[]).map((accent) => (
                                    <button
                                        key={accent}
                                        onClick={() => setSelectedAccent(accent)}
                                        className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                                            selectedAccent === accent ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {accent === 'standard' ? '표준' : accent === 'busan' ? '부산' : '전라'}
                                    </button>
                                ))}
                             </div>
                        </div>

                        {/* Max Duration */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-2 text-xs font-medium text-slate-500">
                                <div className="flex items-center gap-1"><Timer size={14} /> 시간 제한</div>
                             </div>
                             <div className="flex bg-slate-100 rounded-lg p-1">
                                {([null, 5, 10, 30] as (number | null)[]).map((dur) => (
                                    <button
                                        key={String(dur)}
                                        onClick={() => setMaxDuration(dur)}
                                        className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                                            maxDuration === dur ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {dur === null ? '∞' : `${dur}s`}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>
                  </div>
                </>
            ) : (
                /* Library Tab */
                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <button 
                            onClick={toggleSelectionMode}
                            className={`text-xs font-medium flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${isSelectionMode ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            {isSelectionMode ? <CheckSquare size={14} /> : <Square size={14} />}
                            {isSelectionMode ? '선택 취소' : '다중 선택'}
                        </button>
                    </div>

                    {audioLibrary.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <ListMusic size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">생성된 오디오가 없습니다.</p>
                        </div>
                    ) : (
                        <>
                            {/* Favorites Section */}
                            {favoriteClips.length > 0 && (
                                <div className="mb-4 animate-in slide-in-from-top-4 fade-in duration-300">
                                    <h3 className="text-xs font-bold text-rose-500 mb-2 px-1 flex items-center gap-1">
                                        <Heart size={12} fill="currentColor" /> 즐겨찾기 (Favorites)
                                    </h3>
                                    <div className="space-y-2">
                                        {favoriteClips.map((clip, index) => renderClipItem(clip, index, false))}
                                    </div>
                                    <div className="my-4 border-t border-slate-200 border-dashed" />
                                </div>
                            )}

                            {/* Regular Clips Section */}
                            <div className="space-y-2">
                                {regularClips.length > 0 && favoriteClips.length > 0 && (
                                    <h3 className="text-xs font-bold text-slate-400 mb-2 px-1">최근 항목 (Recent)</h3>
                                )}
                                {regularClips.map((clip, index) => renderClipItem(clip, index, true))}
                            </div>
                        </>
                    )}
                </div>
            )}
            
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {error}
              </div>
            )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-5 animate-in fade-in zoom-in-95">
                <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">삭제 하시겠습니까?</h3>
                        <p className="text-xs text-slate-500 mt-1">이 작업은 되돌릴 수 없습니다.</p>
                    </div>
                    <div className="flex gap-2 w-full mt-2">
                        <button onClick={cancelDeleteClip} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">취소</button>
                        <button onClick={confirmDeleteClip} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium">삭제</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Editor Modal */}
      {editingClip && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Scissors size={18} /> 오디오 편집</h3>
                      <button onClick={closeEditor} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  
                  <div className="p-5 space-y-5">
                      {/* Tabs */}
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button 
                             onClick={() => setEditTab('trim')}
                             className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${editTab === 'trim' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                          >
                             <Scissors size={12} className="inline mr-1" /> 자르기 (Trim)
                          </button>
                          <button 
                             onClick={() => setEditTab('split')}
                             className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${editTab === 'split' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                          >
                             <Split size={12} className="inline mr-1" /> 나누기 (Split)
                          </button>
                      </div>

                      {/* Interactive Waveform Visualization */}
                      <div className="bg-slate-900 h-24 rounded-lg flex items-center justify-center relative overflow-hidden select-none">
                           <EditorWaveform 
                               base64Data={editingClip.base64}
                               duration={editingClip.duration}
                               mode={editTab}
                               trimRange={trimRange}
                               splitTime={splitTime}
                               onTimeChange={(time) => {
                                   if (editTab === 'split') {
                                       setSplitTime(time);
                                   } else {
                                       // Smart trim handle update: update the closest handle
                                       const distStart = Math.abs(time - trimRange.start);
                                       const distEnd = Math.abs(time - trimRange.end);
                                       if (distStart < distEnd) {
                                           setTrimRange(prev => ({ ...prev, start: Math.min(time, prev.end) }));
                                       } else {
                                           setTrimRange(prev => ({ ...prev, end: Math.max(time, prev.start) }));
                                       }
                                   }
                               }}
                           />
                           {/* Overlay Info */}
                           <div className="absolute top-2 right-2 pointer-events-none bg-black/50 px-2 py-0.5 rounded text-white/80 text-[10px] font-mono">
                               {editTab === 'trim' 
                                  ? `${(trimRange.end - trimRange.start).toFixed(1)}s selected`
                                  : `Split @ ${splitTime.toFixed(1)}s`
                               }
                           </div>
                           <div className="absolute bottom-2 left-2 pointer-events-none text-white/50 text-[9px] font-mono">
                               Shortcuts: Space (Preview), Enter (Save), Esc (Cancel)
                           </div>
                      </div>

                      {editTab === 'trim' ? (
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs font-medium text-slate-500 block mb-1">시작 시간</label>
                                      <input 
                                          type="number" 
                                          step="0.1"
                                          min="0"
                                          max={trimRange.end}
                                          value={trimRange.start}
                                          onChange={(e) => setTrimRange({...trimRange, start: Number(e.target.value)})}
                                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs font-medium text-slate-500 block mb-1">종료 시간</label>
                                      <input 
                                          type="number" 
                                          step="0.1"
                                          min={trimRange.start}
                                          max={editingClip.duration}
                                          value={trimRange.end}
                                          onChange={(e) => setTrimRange({...trimRange, end: Number(e.target.value)})}
                                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm"
                                      />
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={previewTrim} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                                      <Play size={12} /> 미리듣기
                                  </button>
                                  <button onClick={handleTrimSave} className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                                      <Save size={12} /> 저장하기
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-medium text-slate-500 block mb-1">나눌 지점 (초)</label>
                                  <input 
                                      type="range" 
                                      min="0"
                                      max={editingClip.duration}
                                      step="0.1"
                                      value={splitTime}
                                      onChange={(e) => setSplitTime(Number(e.target.value))}
                                      className="w-full accent-rose-500 mb-2"
                                  />
                                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                                      <span>0s</span>
                                      <span className="text-rose-500 font-bold">{splitTime.toFixed(1)}s</span>
                                      <span>{editingClip.duration.toFixed(1)}s</span>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={previewSplit1} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                                      <Play size={12} /> 앞부분 듣기
                                  </button>
                                  <button onClick={previewSplit2} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                                      <Play size={12} /> 뒷부분 듣기
                                  </button>
                              </div>
                              <button onClick={handleSplitSave} className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                                  <Split size={12} /> 두 개로 나누어 저장
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* A/B Compare Modal */}
      {compareClips && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft size={18} className="text-rose-500" /> A/B 비교 (Comparison)</h3>
               <button onClick={() => { stopAudio(); setCompareClips(null); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6">
                <p className="text-sm text-slate-500 mb-6 text-center">두 클립을 번갈아 재생하며 차이를 확인하세요.</p>
                
                <div className="flex gap-4">
                   {[0, 1].map((idx) => {
                      const clip = compareClips[idx];
                      const otherClip = compareClips[idx === 0 ? 1 : 0];
                      const isPlayingThis = currentClipId === clip.id && isPlaying;
                      
                      // Identify diffs
                      const renderDiff = (label: string, val1: any, val2: any) => {
                          const isDiff = val1 !== val2;
                          return (
                              <div className={`flex justify-between text-[11px] ${isDiff ? 'font-bold text-slate-800 bg-yellow-50 px-1 rounded' : 'text-slate-500'}`}>
                                  <span>{label}:</span>
                                  <span>{String(val1)}</span>
                              </div>
                          );
                      };

                      return (
                          <div key={clip.id} className={`flex-1 rounded-xl p-4 border-2 transition-all ${isPlayingThis ? 'border-rose-500 bg-rose-50 shadow-lg scale-105 z-10' : 'border-slate-100 bg-white'}`}>
                              <div className="text-center mb-3">
                                  <span className="font-bold text-xl text-slate-300 block mb-1">{idx === 0 ? 'A' : 'B'}</span>
                                  <button 
                                      onClick={() => handlePlayClip(clip)}
                                      className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto transition-colors ${isPlayingThis ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                  >
                                      {isPlayingThis ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                                  </button>
                              </div>
                              <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  {renderDiff('Voice', SUPPORTED_VOICES.find(v => v.id === clip.settings.voiceId)?.label, SUPPORTED_VOICES.find(v => v.id === otherClip.settings.voiceId)?.label)}
                                  {renderDiff('Tone', clip.settings.tone, otherClip.settings.tone)}
                                  {renderDiff('Speed', clip.settings.speed, otherClip.settings.speed)}
                                  {renderDiff('Pitch', clip.settings.pitch, otherClip.settings.pitch)}
                                  {renderDiff('Accent', clip.settings.accent, otherClip.settings.accent)}
                                  {renderDiff('Seed', clip.settings.seed, otherClip.settings.seed)}
                              </div>
                          </div>
                      );
                   })}
                </div>
                
                <div className="mt-6 text-center text-xs text-slate-400">
                   Tip: 키보드 <span className="bg-slate-200 px-1 rounded text-slate-600 font-bold">⬅️</span> <span className="bg-slate-200 px-1 rounded text-slate-600 font-bold">➡️</span> 화살표로 즉시 전환
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center z-20 pointer-events-none transition-all duration-300 bg-gradient-to-t from-white/90 via-white/50 to-transparent" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <div className="bg-white/90 backdrop-blur shadow-xl border border-slate-200 p-2 rounded-2xl flex items-center gap-3 pointer-events-auto">
            {isSelectionMode ? (
                 <>
                   <button
                      onClick={handleCompareSelected}
                      disabled={selectedClipIds.size !== 2}
                      className="flex items-center justify-center w-12 h-12 rounded-xl transition-all shadow-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                      title="비교 (Compare)"
                   >
                      <ArrowRightLeft size={18} />
                   </button>
                   <button
                      onClick={handleMergeSelected}
                      disabled={selectedClipIds.size < 2}
                      className="flex items-center justify-center w-12 h-12 rounded-xl transition-all shadow-lg bg-slate-700 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                      title="병합 (Merge)"
                   >
                      <Layers size={18} />
                   </button>
                   <button 
                       onClick={handlePlayLibrarySelection}
                       disabled={selectedClipIds.size === 0}
                       className="flex items-center gap-2 px-6 h-12 rounded-xl font-bold text-base transition-all shadow-lg bg-rose-500 text-white hover:bg-rose-600 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                   >
                       <Play size={18} fill="currentColor" />
                       <span>재생</span>
                   </button>
                 </>
            ) : (
                <>
                    {activeTab === 'library' && isProMode && (
                        <button 
                            onClick={() => audioLibrary.length > 0 && downloadAudioAsWav(audioLibrary[0].base64)}
                            disabled={audioLibrary.length === 0}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="최근 파일 다운로드"
                        >
                            <Download size={20} />
                        </button>
                    )}

                    <button
                        onClick={isPlaying ? stopAudio : (activeTab === 'library' ? handlePlayLibrarySelection : handleGenerateAndPlay)}
                        disabled={isActionDisabled}
                        className={`flex items-center gap-3 px-6 h-12 rounded-xl font-bold text-base transition-all shadow-lg active:scale-95 ${
                        isActionDisabled 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed pl-4 pr-6 shadow-none transform-none' 
                            : isPlaying
                            ? 'bg-slate-800 text-white hover:bg-slate-900 ring-2 ring-slate-200'
                            : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200'
                        }`}
                    >
                        {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>생성 중...</span>
                        </>
                        ) : isPlaying ? (
                        <>
                            <StopCircle size={20} />
                            <span>중지</span>
                            <span className="text-[10px] bg-slate-700 px-1.5 rounded ml-1 text-slate-300">Space</span>
                        </>
                        ) : (
                        <>
                            {activeTab === 'library' ? <Play size={20} fill="currentColor" /> : <Mic size={20} fill="currentColor" className="opacity-80" />}
                            <span>{activeTab === 'library' ? '선택 재생' : '음성 생성'}</span>
                            <span className="text-[10px] bg-rose-400 px-1.5 rounded ml-1 text-white/90">Space</span>
                        </>
                        )}
                    </button>
                </>
            )}
        </div>
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="absolute bottom-1 right-2 z-0 opacity-50 pointer-events-none hidden md:flex gap-4 text-[10px] text-slate-400">
         <span className="flex items-center gap-1"><Keyboard size={10} /> 단축키 지원</span>
      </div>

    </div>
  );
};

export default App;