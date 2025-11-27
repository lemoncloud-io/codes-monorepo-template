import React, { useEffect, useRef, useState } from 'react';
import { getAudioBuffer } from '../services/audioUtils';

interface EditorWaveformProps {
  base64Data: string;
  duration: number;
  mode: 'trim' | 'split';
  trimRange?: { start: number; end: number };
  splitTime?: number;
  onTimeChange: (time: number) => void;
}

const EditorWaveform: React.FC<EditorWaveformProps> = ({ 
  base64Data, 
  duration, 
  mode, 
  trimRange, 
  splitTime, 
  onTimeChange 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    getAudioBuffer(base64Data).then(setAudioBuffer);
  }, [base64Data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Resize to match display size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Background
    ctx.fillStyle = '#0f172a'; // Slate 900
    ctx.fillRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Helper to draw waveform segment
    const drawWave = (color: string, startX: number, endX: number) => {
        ctx.fillStyle = color;
        const startI = Math.floor(startX);
        const endI = Math.ceil(endX);
        
        for (let i = startI; i < endI; i++) {
            let min = 1.0;
            let max = -1.0;
            const dataIdx = i * step;
            if (dataIdx >= data.length) break;

            for (let j = 0; j < step; j++) {
                if (dataIdx + j >= data.length) break;
                const datum = data[dataIdx + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            // Draw bar centered vertically
            const barHeight = Math.max(1, (max - min) * amp);
            ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
        }
    };

    if (mode === 'trim' && trimRange) {
        const startX = (trimRange.start / duration) * width;
        const endX = (trimRange.end / duration) * width;

        // Draw Inactive parts (dimmed)
        drawWave('#334155', 0, startX);
        drawWave('#334155', endX, width);
        // Draw Active part (bright)
        drawWave('#f43f5e', startX, endX);

        // Overlay Dimming for inactive
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, startX, height);
        ctx.fillRect(endX, 0, width - endX, height);

        // Draw Handles
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.max(0, startX - 1), 0, 2, height);
        ctx.fillRect(Math.min(width, endX - 1), 0, 2, height);
    } else if (mode === 'split' && splitTime !== undefined) {
        // Draw Full Active
        drawWave('#f43f5e', 0, width);
        
        // Split Line
        const x = (splitTime / duration) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

  }, [audioBuffer, mode, trimRange, splitTime, duration]);

  const handlePointer = (e: React.PointerEvent) => {
     e.preventDefault();
     const canvas = canvasRef.current;
     if (!canvas) return;
     const rect = canvas.getBoundingClientRect();
     const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
     const time = (x / rect.width) * duration;
     onTimeChange(time);
  };

  return (
    <canvas 
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            handlePointer(e);
        }}
        onPointerMove={(e) => {
            if (e.buttons === 1) handlePointer(e);
        }}
    />
  );
};

export default EditorWaveform;
