import { GoogleGenAI, Modality } from "@google/genai";

// Initialize Gemini Client
// NOTE: API Key is injected via process.env.API_KEY
process.env.API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export type VoiceTone = 'soft' | 'cheerful' | 'calm' | 'firm';
export type VoiceSpeed = 'slow' | 'normal' | 'fast';
export type VoicePitch = 'low' | 'normal' | 'high';
export type VoiceAccent = 'standard' | 'busan' | 'jeolla';

export interface PronunciationRule {
  original: string;
  replacement: string;
}

// Base Gemini Voice IDs
export type BaseVoiceName = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

// Extended Voice Profiles (Personas)
export const SUPPORTED_VOICES = [
  // Original 10
  { id: 'kore_base', baseVoice: 'Kore', label: '은영', gender: '여성', description: '차분한 표준', defaultPitch: 'normal' },
  { id: 'zephyr_base', baseVoice: 'Zephyr', label: '지수', gender: '여성', description: '부드러운 톤', defaultPitch: 'normal' },
  { id: 'puck_base', baseVoice: 'Puck', label: '민준', gender: '남성', description: '안정감', defaultPitch: 'normal' },
  { id: 'charon_base', baseVoice: 'Charon', label: '현우', gender: '남성', description: '깊은 저음', defaultPitch: 'normal' },
  { id: 'fenrir_base', baseVoice: 'Fenrir', label: '준호', gender: '남성', description: '거친 매력', defaultPitch: 'normal' },
  { id: 'zephyr_child', baseVoice: 'Zephyr', label: '유리', gender: '여성', description: '맑은 아이', defaultPitch: 'high' },
  { id: 'puck_child', baseVoice: 'Puck', label: '건우', gender: '남성', description: '활기찬 아이', defaultPitch: 'high' },
  { id: 'kore_senior', baseVoice: 'Kore', label: '말자', gender: '여성', description: '푸근한 할머니', defaultPitch: 'low' },
  { id: 'charon_giant', baseVoice: 'Charon', label: '왕회장', gender: '남성', description: '웅장한 저음', defaultPitch: 'low' },
  { id: 'fenrir_alien', baseVoice: 'Fenrir', label: '깨비', gender: '남성', description: '장난꾸러기', defaultPitch: 'high' },
  
  // New 10 Additions
  { id: 'kore_guide', baseVoice: 'Kore', label: '지혜', gender: '여성', description: '친절한 안내', defaultPitch: 'high' },
  { id: 'puck_news', baseVoice: 'Puck', label: '성진', gender: '남성', description: '뉴스 앵커', defaultPitch: 'low' },
  { id: 'zephyr_shy', baseVoice: 'Zephyr', label: '소미', gender: '여성', description: '수줍은 소녀', defaultPitch: 'high' },
  { id: 'fenrir_noir', baseVoice: 'Fenrir', label: '강호', gender: '남성', description: '느와르 배우', defaultPitch: 'low' },
  { id: 'zephyr_cs', baseVoice: 'Zephyr', label: '미소', gender: '여성', description: '상담원', defaultPitch: 'normal' },
  { id: 'puck_rookie', baseVoice: 'Puck', label: '태양', gender: '남성', description: '열정 신입', defaultPitch: 'high' },
  { id: 'kore_lib', baseVoice: 'Kore', label: '서연', gender: '여성', description: '도서관 사서', defaultPitch: 'normal' },
  { id: 'fenrir_chief', baseVoice: 'Fenrir', label: '덕수', gender: '남성', description: '동네 이장', defaultPitch: 'low' },
  { id: 'charon_robot', baseVoice: 'Charon', label: '알파', gender: '남성', description: '미래 로봇', defaultPitch: 'high' },
  { id: 'zephyr_student', baseVoice: 'Zephyr', label: '나영', gender: '여성', description: '발랄한 학생', defaultPitch: 'high' },
] as const;

export type VoiceProfileId = typeof SUPPORTED_VOICES[number]['id'];

export const generateSpeechFromText = async (
  $param: {
    text: string, 
    tone?: VoiceTone, 
    speed?: VoiceSpeed,
    pitch?: VoicePitch,
    voiceProfileId?: string, 
    maxDurationSeconds?: number | null,
    customStyle?: string,
    accent?: VoiceAccent,
    seed?: number | null,
    pronunciationRules?: PronunciationRule[]
  }
): Promise<string | null> => {
  const {
    text,
    tone = 'soft',
    speed = 'normal',
    pitch = 'normal',
    voiceProfileId = 'kore_base',
    maxDurationSeconds = null,
    customStyle = '',
    accent = 'standard',
    seed = null,
    pronunciationRules = []
  } = $param;

  if (!text || text.trim() === "") return null;

  // Find the base voice from the profile ID
  const profile = SUPPORTED_VOICES.find(v => v.id === voiceProfileId) || SUPPORTED_VOICES[0];
  const voiceName = profile.baseVoice;

  let promptDirective = "";
  
  // Helper to generate pitch instruction
  const getPitchInstruction = () => {
    if (pitch === 'low') return " in a deep, low-pitched voice";
    if (pitch === 'high') return " in a high-pitched voice";
    return "";
  };

  // Helper to generate accent instruction
  const getAccentInstruction = () => {
    if (accent === 'busan') return " with a strong Busan dialect (Satoori)";
    if (accent === 'jeolla') return " with a Jeolla dialect";
    return " with a standard Seoul accent";
  };

  // Handle Pro Mode Custom Style
  if (customStyle && customStyle.trim() !== "") {
     promptDirective = `Say in a style described as "${customStyle}"${getPitchInstruction()}${getAccentInstruction()}, with high fidelity and clear enunciation. The text to read is Korean. Words wrapped in asterisks (e.g. *word*) should be emphasized strongly.`;
  } else {
    // Standard Mode Tone Mapping
    let toneInstruction = "";
    switch (tone) {
      case 'cheerful': toneInstruction = "cheerfully and energetically"; break;
      case 'calm': toneInstruction = "calmly, slowly, and composedly"; break;
      case 'firm': toneInstruction = "firmly, formally, and clearly"; break;
      case 'soft': default: toneInstruction = "softly, gently, and warmly"; break;
    }

    let speedInstruction = "";
    if (speed === 'fast') speedInstruction = " and quickly";
    if (speed === 'slow') speedInstruction = " and slowly";

    promptDirective = `Say ${toneInstruction}${speedInstruction}${getPitchInstruction()}${getAccentInstruction()}, with high fidelity and clear enunciation. The text to read is Korean. Words wrapped in asterisks (e.g. *word*) should be emphasized strongly.`;
  }

  // Duration limit instruction
  if (maxDurationSeconds) {
    promptDirective += ` Try to finish speaking within approximately ${maxDurationSeconds} seconds.`;
  }

  // Pronunciation Rules
  if (pronunciationRules.length > 0) {
    const rulesStr = pronunciationRules.map(r => `"${r.original}" -> "${r.replacement}"`).join(', ');
    promptDirective += `\n\nPronunciation Dictionary (Strictly pronounce the following words as specified): ${rulesStr}.`;
  }

  const fullPrompt = `${promptDirective}\n\n${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
        // Consistency Settings
        temperature: 0.3, // Lower temperature for more stable/deterministic output
        topP: 0.95,
        seed: seed !== null ? seed : undefined, // Use provided seed or let API generate one
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      console.error("No audio data received from Gemini. Full response:", JSON.stringify(response, null, 2));
      throw new Error("No audio data received");
    }
    return audioData;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};

export const estimateAudioDuration = ($param: { text: string; speed: VoiceSpeed }): number => {
    const { text, speed } = $param;
    if (!text) return 0;
    
    // Korean: roughly 4-5 syllables per second.
    // Average 0.22s per char
    let baseDuration = text.length * 0.22;
    
    // Add pauses for punctuation
    const commas = (text.match(/,/g) || []).length;
    const periods = (text.match(/[.!?]/g) || []).length;
    const breaks = (text.match(/\n/g) || []).length;
    
    baseDuration += commas * 0.3;
    baseDuration += periods * 0.8;
    baseDuration += breaks * 0.5;

    // Adjust for speed setting
    let multiplier = 1.0;
    if (speed === 'fast') multiplier = 0.8; // Faster = less time
    if (speed === 'slow') multiplier = 1.25; // Slower = more time

    return baseDuration * multiplier;
};
