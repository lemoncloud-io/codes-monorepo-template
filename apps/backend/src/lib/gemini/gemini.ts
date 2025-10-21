import { GoogleGenAI, Type } from "@google/genai";
import type { GeneratedContent } from '@shared/core/src/types/hello';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    titles: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Generated blog titles"
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Generated blog tags"
    }
  },
  required: ["titles", "tags"],
};

export async function generateBlogContent(keyword: string): Promise<GeneratedContent> {
  const prompt = `'${keyword}'라는 키워드에 대한 블로그 포스팅 제목 5개와 관련 태그 10개를 생성해줘. 제목은 사람들의 클릭을 유도할 수 있도록 흥미롭고 창의적으로 만들어줘. 태그는 검색에 유리하도록 핵심적인 내용으로 구성해줘. 결과는 JSON 형식으로 반환해줘.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    const jsonString = response.text.trim();
    const parsedJson = JSON.parse(jsonString);

    // Basic validation
    if (parsedJson && Array.isArray(parsedJson.titles) && Array.isArray(parsedJson.tags)) {
      return parsedJson as GeneratedContent;
    } else {
      throw new Error("Invalid JSON structure received from API.");
    }

  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error("Failed to generate content from Gemini API.");
  }
}