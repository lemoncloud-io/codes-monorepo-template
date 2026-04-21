/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Image as ImageIcon, Settings } from "lucide-react";
import { GeminiService } from './services/geminiService';
import { CalcService } from './mock/calcService';
import { BannerInput } from './components/BannerInput';
import { BannerPreview } from './components/BannerPreview';

// Extend window for AI Studio API
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const SAMPLES = [
  {
    id: 'tech-quantum',
    label: 'Technical Post',
    content: `# The Future of Quantum Computing\n\nQuantum computing is poised to revolutionize how we process information, solving problems that are currently impossible for classical computers.\n\nDescription: A deep dive into qubits, entanglement, and the next generation of supercomputing.`
  },
  {
    id: 'personal',
    label: 'Personal Story',
    content: `# Finding Peace in the Mountains\n\nLast summer, I spent two weeks disconnected from the world, hiking through the Alps. It was a journey of self-discovery and finding quiet in a noisy world.\n\nDescription: Reflections on nature, solitude, and the importance of mental health.`
  },
  {
    id: 'futuristic',
    label: 'Futuristic Vision',
    content: `# Life in Neo-Tokyo 2099\n\nNeon lights, flying vehicles, and a world where the line between human and machine has blurred. Welcome to the city that never sleeps.\n\nDescription: Exploring the aesthetics and social structures of a cyberpunk future.`
  },
  {
    id: 'tech-llm',
    label: 'LLM',
    content: `# LLM이란 무엇인가? 2026년 실무자를 위한 대규모 언어 모델 완벽 가이드\n\n최근 비즈니스 환경에서 인공지능의 영향력이 확대됨에 따라, 많은 기업이 AI 도입을 통한 디지털 전환을 가속화하고 있습니다. LLM(Large Language Model)이란 방대한 양의 텍스트 데이터를 학습하여 인간의 언어를 이해하고 생성하는 초대형 딥러닝 모델로, Transformer 아키텍처를 기반으로 작동합니다. 실무자들은 이러한 기술적 배경을 이해함으로써 보다 정교한 비즈니스 전략을 수립하고 운영 효율성을 극대화할 수 있는 기회를 맞이하고 있습니다.\n\nDescription: LLM(Large Language Model)이란 방대한 양의 텍스트 데이터를 학습하여 인간의 언어를 이해하고 생성하는 초대형 딥러닝 모델`
  },
  {
    id: 'tech-finetuning',
    label: 'Fine-tuning',
    content: `# AI 모델 파인튜닝의 실제\n\nAI 기술이 비즈니스의 핵심 경쟁력으로 부상함에 따라, 기업 고유의 데이터를 모델에 내재화하려는 시도가 활발해지고 있습니다.\n\nDescription: Fine-tuning이란 사전 학습된 LLM에 특정 도메인 데이터를 추가 학습시켜 맞춤형 성능을 끌어내는 과정으로, 도메인 전문성 강화와 응답 스타일 최적화에 효과적입니다.`
  }
];

export default function App() {
  type CalcOperation = "add" | "minus" | "divide" | "multiply";
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const calcApiBaseUrl = import.meta.env.VITE_CALC_API_BASE_URL || 'http://localhost:8830';

  const [markdown, setMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState<string>('Generated Blog Banner');
  const [imageTitle, setImageTitle] = useState<string>('Blog Banner');
  const [briefConcept, setBriefConcept] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calcId, setCalcId] = useState<string>('add');
  const [calcA, setCalcA] = useState<string>('1');
  const [calcB, setCalcB] = useState<string>('2');
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

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

  const generateBanner = async () => {
    if (!markdown.trim()) {
      setError("Please enter some markdown content first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setBriefConcept(null);

    try {
      const apiKey = geminiApiKey;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
      }

      const geminiService = new GeminiService({ apiKey });

      // 1. Analyze Markdown and create a visual prompt + concept
      const analysisResult = await geminiService.analyzeMarkdown(markdown);
      
      const visualPrompt = analysisResult.prompt || "A minimalist, modern blog banner background with ample negative space.";
      setBriefConcept(analysisResult.concept || null);
      setImageAlt(analysisResult.image_alt || 'Generated Blog Banner');
      setImageTitle(analysisResult.image_title || 'Blog Banner');

      // 2. Generate the image
      const imageUrl = await geminiService.generateImage(visualPrompt);
      setGeneratedImage(imageUrl);

    } catch (err: any) {
      console.error("Generation error:", err);
      const errorMsg = err.message || JSON.stringify(err);
      
      if (errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("403")) {
        setError("Permission Denied. If this persists, please click the settings icon to select a valid API key.");
      } else if (errorMsg.includes("Requested entity was not found")) {
        setError("API Key issue. Please click the settings icon to select a valid key.");
      } else {
        setError("An error occurred during generation. Please try again.");
      }
    } finally {
      setIsGenerating(false);
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

  const calculateWithApi = async () => {
    const id = calcId.trim().toLowerCase();
    const supportedIds: CalcOperation[] = ["add", "minus", "divide", "multiply"];
    const a = Number(calcA);
    const b = Number(calcB);

    // if (!supportedIds.includes(id as CalcOperation)) {
    //   setCalcError('id는 add, minus, divide, multiply 중 하나여야 합니다.');
    //   setCalcResult(null);
    //   return;
    // }

    if (Number.isNaN(a) || Number.isNaN(b)) {
      setCalcError('a와 b는 숫자로 입력해주세요.');
      setCalcResult(null);
      return;
    }

    setIsCalculating(true);
    setCalcError(null);

    try {
      const calcService = new CalcService({
        baseUrl: calcApiBaseUrl,
        isMock: false,
      });
      const result = await calcService.calc(id as CalcOperation, a, b);
      setCalcResult(result.v);
    } catch (err: any) {
      console.error("Calculation error:", err);
      setCalcResult(null);
      setCalcError(err?.message || '계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
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
            AI Blog Banner Designer
          </div>
          <button 
            onClick={handleOpenKeyDialog}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            title="API Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white">Hello API Calculator</h2>
          <p className="mt-1 text-sm text-neutral-400">id, a, b 입력값에 따라 API 결과를 보여줍니다.</p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">id</span>
              <input
                type="text"
                value={calcId}
                onChange={(e) => setCalcId(e.target.value)}
                placeholder="add | minus | divide | multiply"
                className="h-10 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">a</span>
              <input
                type="number"
                value={calcA}
                onChange={(e) => setCalcA(e.target.value)}
                className="h-10 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">b</span>
              <input
                type="number"
                value={calcB}
                onChange={(e) => setCalcB(e.target.value)}
                className="h-10 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100"
              />
            </label>

            <div className="flex items-end">
              <button
                onClick={calculateWithApi}
                disabled={isCalculating}
                className="h-10 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCalculating ? '계산 중...' : '계산하기'}
              </button>
            </div>
          </div>

          {calcError && <p className="mt-3 text-sm text-red-400">{calcError}</p>}
          {calcResult !== null && !calcError && (
            <p className="mt-3 text-sm text-emerald-300">결과: {calcResult}</p>
          )}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <BannerInput
          markdown={markdown}
          setMarkdown={setMarkdown}
          samples={SAMPLES}
          onSampleSelect={handleSampleSelect}
          onGenerate={generateBanner}
          isGenerating={isGenerating}
          error={error}
        />

        <BannerPreview
          generatedImage={generatedImage}
          imageAlt={imageAlt}
          imageTitle={imageTitle}
          briefConcept={briefConcept}
          isGenerating={isGenerating}
          onDownload={downloadImage}
        />
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-neutral-900 text-center text-sm text-neutral-600">
        &copy; 2026 BannerAI. Powered by Gemini 2.5 Flash Image.
      </footer>
    </div>
  );
}
