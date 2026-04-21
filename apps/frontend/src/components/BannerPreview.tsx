import React from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Image as ImageIcon, Download, Info } from "lucide-react";

interface BannerPreviewProps {
  generatedImage: string | null;
  imageAlt: string;
  imageTitle: string;
  briefConcept: string | null;
  isGenerating: boolean;
  onDownload: () => void;
}

export const BannerPreview: React.FC<BannerPreviewProps> = ({
  generatedImage,
  imageAlt,
  imageTitle,
  briefConcept,
  isGenerating,
  onDownload
}) => {
  return (
    <section className="space-y-6">
      <div className="bg-neutral-900 rounded-3xl p-8 shadow-2xl border border-neutral-800 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Preview</h2>
          {generatedImage && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 px-4 py-2 rounded-full transition-colors border border-indigo-900/50"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
        </div>

        <div className="flex-grow relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex items-center justify-center min-h-[400px]">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 p-12 text-center"
              >
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <div className="space-y-1">
                  <p className="font-medium text-white">Analyzing content & designing visual...</p>
                  <p className="text-sm text-neutral-500">Applying expert design principles.</p>
                </div>
              </motion.div>
            ) : generatedImage ? (
              <motion.div key="result" className="w-full h-full flex flex-col">
                <motion.img
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={generatedImage}
                  alt={imageAlt}
                  title={imageTitle}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4 text-neutral-600 p-12 text-center"
              >
                <ImageIcon className="w-16 h-16 stroke-[1px]" />
                <p className="max-w-[240px]">Your generated banner will appear here. Enter markdown and click generate.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {briefConcept && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-indigo-900/20 rounded-xl border border-indigo-900/30 flex gap-3"
          >
            <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Design Concept</p>
              <p className="text-sm text-neutral-300 leading-relaxed">{briefConcept}</p>
            </div>
          </motion.div>
        )}

        {generatedImage && !briefConcept && (
          <div className="mt-6 p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 leading-relaxed">
              <span className="font-semibold text-neutral-400">Pro Tip:</span> This image was generated with intentional negative space. You can overlay your blog title using any design tool for a professional look.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
