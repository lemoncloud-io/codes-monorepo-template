import { GoogleGenAI, Type } from "@google/genai";
import { BannerAnalysis, GeminiServiceConfig } from '../types';

export class GeminiService {
  private ai: any;

  constructor(config: GeminiServiceConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async analyzeMarkdown(markdown: string): Promise<BannerAnalysis> {
    const systemInstruction = `당신은 블로그 컨텐츠를 분석하여 전문적이고 미니멀한 '비즈니스 컨셉 일러스트' 배너를 설계하는 시각 디자이너입니다.
    
핵심 원칙:
1. Visual Style: 부드러운 평면 음영(Flat Shading)을 사용한 현대적이고 정교한 일러스트 스타일.
2. Color Palette: Background: #FFFFFF 또는 #F9F9F9 / Main Objects: Deep Navy, Steel Gray.
3. Constraint: 주황, 노랑 등 유채색 금지. 무채색과 네이비만 사용.
4. Output: 텍스트가 포함되지 않은 이미지 생성용 영문 프롬프트와 SEO 최적화된 메타데이터를 제공합니다.`;

    const userPrompt = `다음 마크다운 데이터를 분석하여 배너 설계를 생성하세요:
    
---
${markdown}
---

결과는 반드시 지정된 JSON 형식으로 응답하세요.`;

    const result = await this. ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: "Detailed English image generation prompt including style and color keywords" },
            concept: { type: Type.STRING, description: "One sentence explanation of the visual concept in Korean" },
            image_alt: { type: Type.STRING, description: "SEO and AEO optimized alt text for the image" },
            image_title: { type: Type.STRING, description: "Professional image title for search visibility" }
          },
          required: ["prompt", "concept", "image_alt", "image_title"]
        }
      }
    });

    return JSON.parse(result.text || "{}");
  }

  async generateImage(visualPrompt: string): Promise<string> {
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        role: 'user',
        parts: [{
          text: visualPrompt + " Minimalist, clean, professional photography, high resolution, no text, 16:9 aspect ratio.",
        }]
      }],
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    let imageUrl = null;
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error("Failed to generate image data.");
    }

    return imageUrl;
  }

  /**
   * calculate using API (for test)
   * - calls `POST /hello/{id}/add` in `eureka-agents-api`
   * - success response: { v: number }
   */
  async add(
    id: "add" | "minus" | "divide" | "multiply" | string,
    a: number,
    b: number
  ): Promise<number> {
    try {
      const apiId = id === "add" ? "0" : id;
      const response = await fetch(`http://localhost:8830/hello/${apiId}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ a, b }),
      });

      // parse response json
      const data = await response.json().catch(() => null);

      // check response.ok explicitly.
      if (!response.ok) {
        throw new Error(`Add API request failed with status ${response.status}`);
      }

      // return calculate result
      if (typeof data?.v === "number") {
        return data.v;
      }

      throw new Error("Unexpected response format from add API.");
    } catch (e) {
      // Normalize unknown thrown values into Error.
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  }
}
