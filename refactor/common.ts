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
import { asYml } from "./lib/yml";

// Factory 함수로 Gemini AI 인스턴스 생성
export const $ai = ((API_KEY: string) => {
  if (!process.env[API_KEY]) {
    throw new Error(`${API_KEY} environment variable not set`);
  }
  const ai = new GoogleGenAI({ apiKey: process.env[API_KEY] });
  return ai;
})("GEMINI_API_KEY");

// --- 파일 입출력 유틸리티 ---
export const $fs = ((_baseRoot: string) => {
  /** read file */
  const readFile = async (filePath: string, baseRoot = _baseRoot) => {
    filePath = baseRoot ? path.join(baseRoot, filePath) : filePath;
    filePath = path.resolve(filePath);
    if (!(await fs.stat(filePath)).isFile()) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFile(filePath, "utf-8");
  };

  /** save file */
  const saveFile = async (
    filePath: string,
    content: string | object,
    baseRoot = _baseRoot
  ) => {
    filePath = baseRoot ? path.join(baseRoot, filePath) : filePath;
    filePath = path.resolve(filePath);
    if (typeof content === "object") content = asYml(content);

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

  type FileName = keyof typeof fileMap;
  const loadCode = async (name: FileName, baseRoot = _baseRoot) => {
    const filePath = fileMap[name];
    return readFile(filePath, path.join(baseRoot, ".."));
  };
  const saveCode = async (
    name: FileName,
    content: string,
    baseRoot = _baseRoot
  ) => {
    const filePath = fileMap[name];
    const fullPath = path.resolve(path.join(baseRoot, "..", filePath));
    await fs.writeFile(fullPath, content, "utf-8");
  };

  const parseResult = (txt: any) => {
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
})(__dirname);
