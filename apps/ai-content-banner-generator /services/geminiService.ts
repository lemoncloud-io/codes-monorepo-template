import { GoogleGenAI, Type } from "@google/genai";

import { AnalysisResult, GenerationStep } from "../types";
import { BrowserWebSocketNetwork, createProxyTransportReceiver, HttpAbstractGenAI, waitWebSocketConnectionId } from "./proxy";
export type { AnalysisResult, GenerationStep };

declare global {
    interface Window {
        VITE_API_URL?: string;
        VITE_API_KEY?: string;
    }
}

const getAI = async () => {
  const ws = new WebSocket('wss://wss.eureka.codes/cht-d1?v2');
  const network = new BrowserWebSocketNetwork(ws);
  await network.ready();

  const connectionId = await waitWebSocketConnectionId(ws, {
    connectMessage: 'device.save',
    timeoutMs: 15_000,
  });

  const transport = createProxyTransportReceiver(network, {
      timeoutMs: 30_000,
  });
  console.log("WebSocket connected with transport ID:", connectionId);
  const ep = window.VITE_API_URL || import.meta.env?.VITE_API_URL || 'http://localhost:8830/agents/!/generate';
  console.log("Using API endpoint:", ep);
  const ki = window.VITE_API_KEY || import.meta.env?.VITE_API_KEY || '****';


  //* make http proxy.
  const ai = new class extends HttpAbstractGenAI {
      constructor() {
          super(ep, {
              transportId: connectionId,
              transport,
              headers: {
                  'x-api-key': ki,
              },
          });
      }
      protected asEndpoint() {
        if (!connectionId) return this.endpoint;
        const url = new URL(this.endpoint, 'http://localhost');
        url.searchParams.set('connection', connectionId);
        url.searchParams.set('transport', '1');
        if (/^https?:\/\//.test(this.endpoint)) return url.toString();
        return `${url.pathname}${url.search}${url.hash}`;
      }
  };
  return ai;
};

export async function analyzeContent(markdown: string, targetType: 'blog' | 'social'): Promise<{ result: AnalysisResult; steps: GenerationStep[] }> {
  const ai = await getAI();
  const isSocial = targetType === 'social';

  const analysisSystemPrompt = isSocial 
    ? `당신은 개인이 기술/지식을 탐구하고 기록하는 소셜 콘텐츠에 어울리는 이미지를 설계하는 시각 디자이너입니다.
"내가 찾아봤더니 이랬음", "해봤더니 이랬음" 같은 개인 탐구 기록의 느낌을 시각화하세요.

## Design Principles

### 1. Visual Style
아래 중 콘텐츠 주제에 맞는 스타일을 선택하십시오.
- **다이어그램형**: 개념 구조, 흐름도, 비교표 등을 깔끔하게 시각화. 기술 개념 설명에 적합.

### 2. Color Palette
- Background: 화이트(#FFFFFF) 또는 연한 크림(#FAF8F5)
- Main Objects: 딥 네이비, 스틸 그레이
- Accent: 소프트 블루, 민트, 라벤더 등 차분한 유채색 1가지 포인트 허용
- **Constraint**: 원색 및 화려한 유채색 사용 금지

### 3. Mood
- 딱딱하지 않고 가볍게. 하지만 허술하지 않게.
- 누군가 직접 손으로 정리한 듯한 느낌.
- 깔끔하고 읽기 쉬운 구성.

### 4. Composition
**1:1**
- 핵심 오브제 또는 다이어그램을 중앙 배치.
- 상단 여백 확보 (텍스트 오버레이용).

## Guidelines
- 이미지 내부에 텍스트는 영어로만 삽입.` 
    : `당신은 개성 있고 읽기 편한 '테크 블로그 컨셉 일러스트' 배너를 설계하는 시각 디자이너입니다.
입력된 마크다운 데이터에서 핵심 키워드를 추출하여, 이를 추상적인 테크 오브제(예: 도표, 연결망, 코드, 데이터 흐름 등)로 치환하여 구상하세요.

## Design Principles

### 1. Visual Style
- **Shading:** 연한 그레이 톤의 부드러운 평면 음영(Flat Shading)만 사용하여 입체감을 줍니다.
- **Elements:** 인물이나 사물 주변에 데이터 차트, 분석 그래프, 연결 점(Nodes)과 같은 추상적인 요소들이 정교하게 레이어드된 스타일입니다.
- **Mood:** 전문적이면서도 친근한 분위기를 유지하며, 캐릭터가 포함될 경우 약간의 표정과 개성을 허용합니다.

### 2. Color Palette
- **Background:** 완전한 화이트(#FFFFFF) 또는 아주 연한 그레이(#F9F9F9).
- **Main Objects:** 딥 네이비(Deep Navy), 스틸 그레이(Steel Gray).
- **Accent:** 블루 또는 그린 계열 포인트 컬러 1가지를 10% 이내로 제한적으로 사용할 수 있습니다.
- **Constraint:** 주황, 노랑 등 원색이나 화려한 유채색은 사용하지 마세요.

### 3. Composition
- **Layout:** 메인 피사체는 우측 또는 좌측에 배치하되, 중앙 정렬도 허용합니다.
- **Negative Space:** 제목 텍스트가 들어갈 수 있도록 충분한 여백을 반드시 확보하세요.

## Guidelines
- 언어: 한국어를 기본으로 작성합니다.`;

  const analysisUserPrompt = isSocial ? `# Social Image

## Contents
\`\`\`md
${markdown}
\`\`\`
` : `# Blog Image

## Contents
\`\`\`md
${markdown}
\`\`\`

## Description
입력된 마크다운 데이터에서 핵심 키워드를 추출하여 전문적인 테크 블로그 배너를 설계하세요.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: analysisUserPrompt }] }],
    config: {
      systemInstruction: analysisSystemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompt: { 
            type: Type.STRING, 
            description: "스타일 및 색상 키워드를 포함한 상세한 이미지 생성 한국어 프롬프트" 
          },
          concept: { 
            type: Type.STRING, 
            description: "시각적 컨셉에 대한 한 문장 설명" 
          },
          image_alt: { 
            type: Type.STRING, 
            description: "SEO 및 AEO에 최적화된 이미지 대체 텍스트" 
          },
          image_title: { 
            type: Type.STRING, 
            description: "검색 가시성을 위한 이미지 제목" 
          }
        },
        required: ["prompt", "concept", "image_alt", "image_title"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}") as AnalysisResult;
 
   return {
     result,
     steps: [{
       name: `${targetType.toUpperCase()} Analysis`,
       type: 'analyze',
       output: result
     }]
   };
 }

export async function generateImageFromAnalysis(analysis: AnalysisResult, targetType: 'blog' | 'social'): Promise<{ imageUrl: string; step: GenerationStep }> {
  const ai = await getAI();
  const isSocial = targetType === 'social';
  const aspectRatio = isSocial ? "1:1" : "16:9";

  const imageGenPrompt = `${analysis.prompt}`

  const systemInstruction = "당신은 설계된 이미지 프롬프트를 기반으로 블로그 대표 이미지를 생성하는 Image Generator입니다. 제공된 prompt와 concept을 그대로 사용하여 고품질 이미지를 생성하세요.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: imageGenPrompt,
          },
        ],
      },
      config: {
        systemInstruction,
        // @ts-ignore
        imageConfig: {
          aspectRatio: aspectRatio,
          // imageSize: "1K"
        }
      }
    });

    let imageUrl = "";
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (imageUrl) {
      return {
        imageUrl,
        step: {
          name: 'Generate Image (HQ)',
          type: 'generate',
          output: "✨ Image generated successfully using high-quality model."
        }
      };
    }
  } catch (err: any) {
    console.warn("HQ image generation failed, falling back to general model...", err);
  }

  // Fallback to gemini-2.5-flash-image
  const fallbackModel = 'gemini-2.5-flash-image';
  const fallbackResponse = await ai.models.generateContent({
    model: fallbackModel,
    contents: {
      parts: [
        {
          text: imageGenPrompt,
        },
      ],
    },
    config: {
      systemInstruction,
      // @ts-ignore
      imageConfig: {
        aspectRatio: aspectRatio,
      }
    }
  });

  let fallbackImageUrl = "";
  if (fallbackResponse.candidates && fallbackResponse.candidates.length > 0) {
    for (const part of fallbackResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        fallbackImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!fallbackImageUrl) {
    throw new Error("Failed to generate image data even with fallback model. " + (fallbackResponse.text || ""));
  }

  return {
    imageUrl: fallbackImageUrl,
    step: {
      name: 'Generate Image (Fallback)',
      type: 'generate',
      output: "✨ Image generated successfully using fallback model."
    }
  };
}
