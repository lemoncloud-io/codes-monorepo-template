/**
 * Decodes a base64 string into a Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array to a base64 string.
 * Handles large arrays by processing in chunks to avoid stack overflow.
 */
export function encodeBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 0x8000; // 32k chunks
    for (let i = 0; i < len; i += chunkSize) {
        // use subarray to avoid copying
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
}

// Gemini TTS standard output format
const SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2; // 16-bit
const BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_SAMPLE;

/**
 * Trims raw PCM audio data between startSec and endSec.
 */
export function trimPcmAudio(base64: string, startSec: number, endSec: number): string {
  const bytes = decodeBase64(base64);
  const startByte = Math.floor(startSec * BYTES_PER_SECOND);
  const endByte = Math.floor(endSec * BYTES_PER_SECOND);
  
  // Align to 2-byte boundary (16-bit sample)
  const alignedStart = startByte - (startByte % 2);
  const alignedEnd = endByte - (endByte % 2);
  
  const actualStart = Math.max(0, alignedStart);
  const actualEnd = Math.min(bytes.length, alignedEnd);
  
  if (actualStart >= actualEnd) return "";
  
  const sliced = bytes.slice(actualStart, actualEnd);
  return encodeBase64(sliced);
}

/**
 * Splits raw PCM audio data at splitSec.
 * Returns [part1_base64, part2_base64]
 */
export function splitPcmAudio(base64: string, splitSec: number): [string, string] {
  const bytes = decodeBase64(base64);
  const splitByte = Math.floor(splitSec * BYTES_PER_SECOND);
  
  // Align
  const alignedSplit = splitByte - (splitByte % 2);
  const actualSplit = Math.max(0, Math.min(bytes.length, alignedSplit));
  
  const part1 = bytes.slice(0, actualSplit);
  const part2 = bytes.slice(actualSplit);
  
  return [encodeBase64(part1), encodeBase64(part2)];
}

/**
 * Merges multiple raw PCM audio strings into one.
 */
export function mergePcmAudios(base64List: string[]): string {
  const arrays = base64List.map(decodeBase64);
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  
  return encodeBase64(result);
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * Gemini TTS returns raw PCM (usually 24kHz).
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: BaseAudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert 16-bit PCM to floating point audio (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export interface AudioPlaybackResult {
  source: AudioBufferSourceNode;
  analyser: AnalyserNode;
  audioContext: AudioContext;
}

/**
 * Calculates the duration of a base64 encoded PCM audio string without playing it.
 */
export async function getAudioDurationFromBase64(base64String: string): Promise<number> {
  // Use OfflineAudioContext for lighter resource usage
  const OfflineContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx = new OfflineContextClass(1, 1, 24000);
  
  try {
    const bytes = decodeBase64(base64String);
    const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
    return buffer.duration;
  } catch (e) {
    console.error("Error calculating duration:", e);
    return 0;
  }
}

/**
 * Returns an AudioBuffer from a base64 encoded PCM string using OfflineAudioContext.
 */
export async function getAudioBuffer(base64String: string): Promise<AudioBuffer | null> {
    const OfflineContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    // We don't know the length yet, but 1 frame is enough to create the buffer factory
    const ctx = new OfflineContextClass(1, 1, 24000);
    
    try {
      const bytes = decodeBase64(base64String);
      return await decodeAudioData(bytes, ctx, 24000, 1);
    } catch (e) {
      console.error("Error decoding audio buffer:", e);
      return null;
    }
}

/**
 * Plays the provided base64 audio string using the Web Audio API.
 * Returns the AudioBufferSourceNode, AnalyserNode, and AudioContext.
 */
export async function playBase64Audio(
  base64String: string, 
  onEnded?: () => void
): Promise<AudioPlaybackResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  
  // Use system default sample rate for high-quality playback
  const audioContext = new AudioContextClass();

  const bytes = decodeBase64(base64String);
  const audioBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create Analyser for visualization
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256; // Trade-off between resolution and speed
  
  // Connect graph: Source -> Analyser -> Destination
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  
  source.onended = () => {
    if (onEnded) onEnded();
    // Short delay to allow visualizer to clear down naturally before closing context
    setTimeout(() => {
        if (audioContext.state !== 'closed') {
            audioContext.close();
        }
    }, 100);
  };

  source.start(0);
  return { source, analyser, audioContext };
}

/**
 * Writes a WAV header for the given PCM data.
 */
function writeWavHeader(sampleRate: number, numChannels: number, dataLength: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataLength, true); // file length - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataLength, true); // Subchunk2Size

  return buffer;
}

/**
 * Downloads the base64 audio string as a WAV file.
 */
export function downloadAudioAsWav(base64String: string, filename: string = 'generated-speech.wav') {
  const pcmBytes = decodeBase64(base64String) as any;
  // Gemini usually outputs 24kHz mono PCM 
  const sampleRate = 24000;
  const numChannels = 1;
  
  const header = writeWavHeader(sampleRate, numChannels, pcmBytes.length);
  const wavBlob = new Blob([header, pcmBytes], { type: 'audio/wav' });
  
  const url = URL.createObjectURL(wavBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}