import React, { useEffect, useRef, useState } from 'react';
import { getAudioBuffer } from '../services/audioUtils';

interface SpectrumIconProps {
  base64Data: string;
  width?: number;
  height?: number;
  className?: string;
}

const SpectrumIcon: React.FC<SpectrumIconProps> = ({ base64Data, width = 48, height = 48, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isRendered) return;

    let mounted = true;

    const renderSpectrum = async () => {
      const buffer = await getAudioBuffer(base64Data);
      if (!buffer || !canvasRef.current || !mounted) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle High DPI
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Clear
      ctx.fillStyle = '#1e293b'; // Slate 800 background
      ctx.fillRect(0, 0, width, height);

      const data = buffer.getChannelData(0);
      const step = Math.floor(data.length / width);
      
      // Draw Spectrogram-like Heatmap
      // X-axis: Time
      // Y-axis: Frequency (Simulated)
      for (let x = 0; x < width; x++) {
        // Calculate RMS for this time slice
        let sum = 0;
        for (let i = 0; i < step; i++) {
          const val = data[x * step + i];
          sum += val * val;
        }
        const rms = Math.sqrt(sum / step);
        const intensity = Math.min(1, rms * 5); // Amplify for visibility

        // Draw vertical column pixels
        const bands = 8; // Number of vertical frequency bands
        const bandHeight = height / bands;

        for (let y = 0; y < bands; y++) {
             // Simulate energy distribution: Voice has more energy in low/mid frequencies (bottom)
             
             const normalizedY = (bands - y) / bands; // 0 to 1
             
             // Probability of this band lighting up depends on RMS and frequency
             // Higher RMS = more bands light up
             const threshold = 1 - normalizedY * 0.8;
             
             if (intensity > threshold - (Math.random() * 0.2)) {
                 // Color Map
                 const hue = 260 - (normalizedY * 220); 
                 const alpha = (intensity * normalizedY) + 0.2;
                 
                 ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
                 
                 // Flip vertically: Draw from bottom up
                 // y=0 is the first iteration, we map it to the bottom-most band
                 ctx.fillRect(x, height - (y + 1) * bandHeight, 1, bandHeight);
             }
        }
      }
      setIsRendered(true);
    };

    renderSpectrum();

    return () => {
      mounted = false;
    };
  }, [base64Data, width, height, isRendered]);

  return (
    <canvas 
        ref={canvasRef} 
        className={`rounded-lg shadow-sm ${className}`}
        width={width}
        height={height}
    />
  );
};

export default SpectrumIcon;