import React from 'react';
import { motion } from "motion/react";
import { Sparkles, Send, AlertCircle } from "lucide-react";
import { Sample } from '../types';

interface BannerInputProps {
  markdown: string;
  setMarkdown: (value: string) => void;
  samples: Sample[];
  onSampleSelect: (content: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
}

export const BannerInput: React.FC<BannerInputProps> = ({
  markdown,
  setMarkdown,
  samples,
  onSampleSelect,
  onGenerate,
  isGenerating,
  error
}) => {
  return (
    <section className="space-y-6">
      <div className="bg-neutral-900 rounded-3xl p-8 shadow-2xl border border-neutral-800 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Markdown Input
            </h2>
            <p className="text-sm text-neutral-400">
              Paste your blog post content or select a sample below.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {samples.map((sample) => (
              <button
                key={sample.id}
                onClick={() => onSampleSelect(sample.content)}
                className="px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full border border-neutral-700 transition-colors"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="# My Awesome Blog Post\n\nIntroduction goes here...\n\nDescription: A short summary."
          className="w-full h-80 p-6 bg-neutral-950 rounded-2xl border border-neutral-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none font-mono text-sm leading-relaxed text-neutral-300 placeholder:text-neutral-600"
        />

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/20 disabled:shadow-none"
        >
          {isGenerating ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Designing & Generating...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Generate Banner
            </>
          )}
        </button>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-red-900/20 text-red-400 rounded-xl border border-red-900/30 text-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </div>
    </section>
  );
};
