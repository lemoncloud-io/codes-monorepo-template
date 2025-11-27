import React, { useEffect, useRef } from 'react';

interface WaveformProps {
  isPlaying: boolean;
  analyser: AnalyserNode | null;
}

const Waveform: React.FC<WaveformProps> = ({ isPlaying, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set explicit resolution matching the CSS size * DPR
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = analyser ? new Uint8Array(bufferLength) : new Uint8Array(0);

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (isPlaying && analyser) {
        analyser.getByteFrequencyData(dataArray);

        // Visualizer config
        const barCount = 30; // Number of bars to draw
        const barWidth = (rect.width / barCount) * 0.6; // Bar width with spacing
        const spacing = (rect.width / barCount) * 0.4;
        const centerX = rect.width / 2;
        const totalWidth = barCount * (barWidth + spacing);
        const startX = (rect.width - totalWidth) / 2;

        // Draw symmetric bars
        for (let i = 0; i < barCount; i++) {
           // Map visualizer bars to frequency bins (focusing on lower-mid frequencies for voice)
           // Voice usually sits in lower part of spectrum, so we map i to a lower range of dataArray
           const dataIndex = Math.floor(i * (bufferLength / (barCount * 1.5)));
           const value = dataArray[dataIndex] || 0;
           
           // Calculate height (scaled)
           const percent = value / 255;
           const height = Math.max(4, percent * rect.height * 0.8); // Min height 4px

           // Calculate X position
           const x = startX + i * (barWidth + spacing);
           const y = (rect.height - height) / 2;

           // Gradient color based on height
           const gradient = ctx.createLinearGradient(0, y, 0, y + height);
           gradient.addColorStop(0, '#f43f5e'); // Rose 500
           gradient.addColorStop(1, '#fda4af'); // Rose 300

           ctx.fillStyle = gradient;
           
           // Draw rounded pill shape
           ctx.beginPath();
           ctx.roundRect(x, y, barWidth, height, 50);
           ctx.fill();
        }
      } else {
        // Idle State: Small pulsing dots
        const dotCount = 5;
        const dotSpacing = 15;
        const totalDotsWidth = dotCount * 6 + (dotCount - 1) * dotSpacing;
        const startX = (rect.width - totalDotsWidth) / 2;
        const centerY = rect.height / 2;

        for (let i = 0; i < dotCount; i++) {
             ctx.beginPath();
             ctx.arc(startX + i * (6 + dotSpacing), centerY, 3, 0, Math.PI * 2);
             ctx.fillStyle = '#e2e8f0'; // Slate 200
             ctx.fill();
        }
      }

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, analyser]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }} 
      />
    </div>
  );
};

export default Waveform;