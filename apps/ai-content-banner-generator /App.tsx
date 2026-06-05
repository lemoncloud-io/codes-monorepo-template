/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Image as ImageIcon, Loader2, Sparkles, Send, Download, AlertCircle, Settings, Info, Terminal, Code, RotateCcw } from "lucide-react";
import { analyzeContent, generateImageFromAnalysis } from './services/geminiService';
import { GenerationStep } from './types';

// Extend window for AI Studio API
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [markdown, setMarkdown] = useState('');
  const [targetType, setTargetType] = useState<'blog' | 'social'>('blog');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'analyzing' | 'generating'>('idle');
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState<string>('Generated Blog Banner');
  const [imageTitle, setImageTitle] = useState<string>('Blog Banner');
  const [briefConcept, setBriefConcept] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<GenerationStep[]>([]);

  const SAMPLES = [];

  const handleSampleSelect = (content: string) => {
    setMarkdown(content);
    setError(null);
  };

  const handleOpenKeyDialog = async () => {
    try {
      await window.aistudio.openSelectKey();
    } catch (e) {
      console.error("Error opening key dialog:", e);
    }
  };

  const handleAnalyze = async () => {
    if (!markdown.trim()) {
      setError("Please enter some markdown content first.");
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('analyzing');
    setError(null);
    setGeneratedImage(null);
    setBriefConcept(null);
    setAnalysisResult(null);
    setSteps([]);

    try {
      const { result, steps: analysisSteps } = await analyzeContent(markdown, targetType);
      
      setSteps(prev => [...prev, ...analysisSteps]);
      setAnalysisResult(result);
      setBriefConcept(result.concept);
      setImageAlt(result.image_alt);
      setImageTitle(result.image_title);
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError("Analysis failed: " + (err.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
      setGenerationStatus('idle');
    }
  };

  const handleGenerateImage = async () => {
    if (!analysisResult) return;

    setIsGenerating(true);
    setGenerationStatus('generating');
    setError(null);

    try {
      const { imageUrl, step: imageStep } = await generateImageFromAnalysis(analysisResult, targetType);
      setGeneratedImage(imageUrl);
      setSteps(prev => [...prev, imageStep]);
    } catch (err: any) {
      console.error("Generation error:", err);
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("403")) {
        setError("Permission Denied (403). Ensure you have a Billing-Enabled API key selected.");
      } else {
        setError("Generation failed: " + errorMsg);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus('idle');
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'blog-banner.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
      <header className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
            <ImageIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">BannerAI</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-sm font-medium text-neutral-400 bg-neutral-900 px-4 py-2 rounded-full border border-neutral-800 shadow-sm">
            Content Banner Designer
          </div>
          <button 
            onClick={() => {
              setMarkdown("");
              setAnalysisResult(null);
              setBriefConcept(null);
              setGeneratedImage(null);
              setSteps([]);
              setError(null);
            }}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/50"
            title="Reset All"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleOpenKeyDialog}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            title="API Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Input Section */}
        <section className="space-y-6">
          <div className="bg-neutral-900 rounded-3xl p-8 shadow-2xl border border-neutral-800 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Content Input
                  </h2>
                  <p className="text-sm text-neutral-400">
                    Choose mode and paste your content.
                  </p>
                </div>
                <div className="flex p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                  <button
                    onClick={() => setTargetType('blog')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      targetType === 'blog' 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Blog
                  </button>
                  <button
                    onClick={() => setTargetType('social')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      targetType === 'social' 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Social
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSampleSelect(sample.content)}
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
              placeholder="Paste your markdown content here...&#10;&#10;Example:&#10;# Blog Title&#10;Introduction...&#10;Description: Summary."
              className="w-full h-80 p-6 bg-neutral-950 rounded-2xl border border-neutral-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none font-mono text-sm leading-relaxed text-neutral-300 placeholder:text-neutral-600"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleAnalyze}
                disabled={isGenerating}
                className="py-4 px-6 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-700 text-white font-semibold rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 border border-neutral-700"
              >
                {isGenerating && generationStatus === 'analyzing' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze Content
                  </>
                )}
              </button>

              <button
                onClick={handleGenerateImage}
                disabled={isGenerating || !analysisResult}
                className="py-4 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/20 disabled:shadow-none"
              >
                {isGenerating && generationStatus === 'generating' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    Generate Image
                  </>
                )}
              </button>
            </div>

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

        {/* Preview Section */}
        <section className="space-y-6">
          <div className="bg-neutral-900 rounded-3xl p-8 shadow-2xl border border-neutral-800 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Preview</h2>
              {generatedImage && (
                <button
                  onClick={downloadImage}
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
                      <p className="font-medium text-white">
                        {generationStatus === 'analyzing' 
                          ? 'Analyzing content & designing visual...' 
                          : 'Generating your custom banner image...'}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {generationStatus === 'analyzing' 
                          ? 'Extracting keywords and applying design principles.' 
                          : 'Converting design concept into a high-quality visual.'}
                      </p>
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
      </main>

      {/* Process Details Section */}
      <AnimatePresence>
        {steps.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto px-6 pb-20"
          >
            <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-600/20 rounded-lg">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Generation Process</h2>
                  <p className="text-sm text-neutral-400">Step-by-step insight into how the AI processed your request.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {steps.map((step, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px]">{idx + 1}</span>
                        {step.name}
                      </h3>
                      <div className="px-2 py-1 bg-neutral-800 rounded text-[10px] font-mono text-neutral-500 uppercase">
                        {step.type}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Input */}
                      {step.input && (
                        <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
                          <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase">Input</span>
                            <Code className="w-3 h-3 text-neutral-600" />
                          </div>
                          <pre className="p-4 text-xs font-mono text-indigo-300/80 overflow-x-auto">
                            {typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Output */}
                      <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
                        <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-500/80 uppercase">Output</span>
                          <Code className="w-3 h-3 text-emerald-600/50" />
                        </div>
                        <pre className="p-4 text-xs font-mono text-emerald-400/80 overflow-x-auto whitespace-pre-wrap">
                          {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-neutral-900 text-center text-sm text-neutral-600">
        &copy; 2026 BannerAI. Powered by Gemini 3.1 Flash Image.
      </footer>
    </div>
  );
}
