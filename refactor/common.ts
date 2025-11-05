/**
 * common.ts
 * - Gemini AI 리팩토링 공통 모듈
 *
 * @author      Steve <steve@example.com>
 */
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import "dotenv/config"; // API 키를 .env 파일에서 로드
import { asYml, fromYml } from "./lib/yml";

// Factory 함수로 Gemini AI 인스턴스 생성
export const $ai = (API_KEY: string) => {
  if (!process.env[API_KEY]) {
    throw new Error(`${API_KEY} environment variable not set`);
  }
  const ai = new GoogleGenAI({ apiKey: process.env[API_KEY] });
  return ai;
};

// Factory 함수로 파일 시스템 유틸리티 생성
export const $fs = (scope: string, _baseRoot: string = __dirname) => {
  /** read file */
  const readFile = async <T = any>(filePath: string, baseRoot = _baseRoot): Promise<T> => {
    filePath = baseRoot ? path.join(baseRoot, filePath) : filePath;
    filePath = path.resolve(filePath);
    if (!(await fs.stat(filePath)).isFile()) throw new Error(`File not found: ${filePath}`);

    const content = await fs.readFile(filePath, "utf-8");
    if (typeof content === "string" && filePath.endsWith(".yml")) {
      const res = fromYml<object>(content);
      return res as unknown as T;
    }
    if (typeof content === "string" && content.startsWith("{") && content.endsWith("}")) {
      return JSON.parse(content) as T;
    }
    return content as unknown as T;
  };

  /** save file */
  const saveFile = async (
    filePath: string,
    content: string | object,
    baseRoot = _baseRoot
  ) => {
    filePath = baseRoot ? path.join(baseRoot, filePath) : filePath;
    filePath = path.resolve(filePath);
    if (typeof content === "object" && filePath?.endsWith(".yml")) content = asYml(content);
    else if (typeof content === "object") content = JSON.stringify(content, null, 2);

    if (!(await fs.lstat(path.dirname(filePath))).isDirectory())
      await fs.mkdir(path.dirname(filePath), { recursive: true });

    return fs.writeFile(filePath, content, "utf-8");
  };

  /**
   * 파일 맵 정의
   */
  const fileMap: Record<string, string> = {
    serviceCode: "apps/backend/src/services/geminiService.ts",
    typeCode: "apps/backend/src/services/types.ts",
    apiCode: "apps/backend/src/api/hello-api.ts",
  };
  if (scope == 'frontend'){
    fileMap.serviceCode = "apps/frontend/src/services/geminiService.ts";
    fileMap.typeCode = "apps/frontend/src/types.ts";
    fileMap.apiCode = "";
  }

  type FileName = keyof typeof fileMap;
  const asFileName = (file: string): FileName => {
    return Object.entries(fileMap).find(([_, v]) => v === file)?.[0] as FileName;
  };
  const loadCode = async (name: FileName, baseRoot = _baseRoot) => {
    const filePath = fileMap[name];
    if (!filePath) return '';
    return readFile(filePath, path.join(baseRoot, ".."));
  };
  const saveCode = async (
    name: FileName,
    content: string,
    baseRoot = _baseRoot
  ) => {
    const filePath = fileMap[name];
    if (!filePath) throw new Error(`Unknown file name: ${name}`);
    const fullPath = path.resolve(path.join(baseRoot, "..", filePath));
    console.log(`>> Saving code[${name}] to`, fullPath);
    await fs.writeFile(fullPath, content, "utf-8");
  };

  const parseResult = (txt: any) => {

    if (typeof txt !== "string") return null;
    if (txt.startsWith('@apps/')){
      const arr = txt.split('@apps/').map(part => `@apps/${part}`).map(s => {
        const i = s.indexOf('\n');
        if (i === -1 || !s) return { file: null, content: s.trim() };
        const file = s.substring(1, i).trim();
        const content = parseResult(s.substring(i).trim());
        return { file, content };
      });
      const result: Record<FileName, string> = {};
      for (const item of arr){
        if (item?.file) {
          const itemFileName = asFileName(item.file);
          result[itemFileName] = item.content as string;
        }
      }
      return result;
    }

    try {
      const match =
        typeof txt === "string"
          ? txt.match(/^```(?:typescript|ts)?\s*\n?([\s\S]*?\n?)```[\s\n]*$/)
          : null;
      if (match) {
        txt = match[1];
        return txt;
      } else if (
        typeof txt === "string" &&
        txt.startsWith("```") &&
        txt.endsWith("```")
      ) {
        const lines = txt.split("\n");
        lines.shift(); // 첫 번째 줄 제거 (```typescript)
        lines.pop(); // 마지막 줄 제거 (```)
        txt = lines.join("\n").trim();
        return txt;
      }
      return JSON.parse(txt || "");
    } catch (e) {
      console.log(txt);
      console.error("! JSON 파싱 오류:", e);
      return null;
    }
  };

  // export.
  return { readFile, saveFile, loadCode, saveCode, parseResult };
};
