/**
 * Gemini API를 사용하여 TypeScript 코드를 리팩토링하는 스크립트(샘플)
 *
 * 사용법:
 * ```sh
 * # run step.1
 * npx ts-node refactor.ts 1
 * ```
 */
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import "dotenv/config"; // API 키를 .env 파일에서 로드
import mustache from "mustache";

// Factory 함수로 Gemini AI 인스턴스 생성
const $ai = ((API_KEY: string) => {
  if (!process.env[API_KEY]) {
    throw new Error(`${API_KEY} environment variable not set`);
  }
  const ai = new GoogleGenAI({ apiKey: process.env[API_KEY] });
  return ai;
})("GEMINI_API_KEY");

/** read file */
const readFile = async (filePath: string, baseRoot?: string) => {
  filePath = baseRoot ? path.join(baseRoot, filePath) : filePath;
  filePath = path.resolve(filePath);
  if (!(await fs.stat(filePath)).isFile()) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFile(filePath, "utf-8");
};

const fileMap: Record<string, string> = {
  serviceCode: "apps/backend/src/services/geminiService.ts",
  typeCode: "apps/backend/src/services/types.ts",
  apiCode: "apps/backend/src/api/hello-api.ts",
};

type FileName = keyof typeof fileMap;
const loadCode = async (name: FileName) => {
  const filePath = fileMap[name];
  return readFile(filePath, path.join(__dirname, ".."));
};
const saveCode = async (name: FileName, content: string) => {
  const filePath = fileMap[name];
  const fullPath = path.resolve(path.join(__dirname, "..", filePath));
  await fs.writeFile(fullPath, content, "utf-8");
};

// 메인 리팩토링 함수
async function refactorCode(args: string[]) {
  // 2. CLI 입력 파라미터로 파일 경로 받기
  const runStep = args[2];
  if (!runStep || !/^[0-9]+$/.test(runStep))
    throw new Error(
      `리팩토링할 파일 경로를 입력해주세요. 예: ts-node refactor.ts 1 (입력: ${runStep})`
    );

  console.log(`Starting code refactoring for step[${runStep}] ...`);
  // if (Number(runStep) >= 1 && Number(runStep) <= 3) {
  //   return loadCode(['serviceCode', 'typeCode', 'apiCode'][Number(runStep) - 1] as any).then(code => console.log(code));
  // }

  try {
    // --- 프롬프트 설정 ---
    const SYSTEM_PROMPT = await readFile("prompt/SYSTEM.md", __dirname);
    const USER_PROMPT = await readFile(
      `prompt/USER-STEP${runStep}.md`,
      __dirname
    );
    const [serviceCode, typeCode, apiCode] = await Promise.all([
      loadCode("serviceCode"),
      loadCode("typeCode"),
      loadCode("apiCode"),
    ]);
    const prompt = mustache.render(USER_PROMPT, {
      serviceCode,
      typeCode,
      apiCode,
    });

    // if (prompt) return console.log(prompt);

    console.log("🤖 Gemini에게 코드 리팩토링을 요청합니다...");
    console.log("==================================================");

    // 5. Gemini API 호출
    const result = await $ai.models.generateContent({
      model: 1 ? "gemini-2.5-pro" : "gemini-pro",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
        // maxOutputTokens: 2048, //WARN - may not work!
      },
    });

    // 6. 호출 결과
    const jsonString = result?.text?.trim();
    const _parseJson = (txt: any) => {
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
        console.log(jsonString);
        console.error("! JSON 파싱 오류:", e);
        return null;
      }
    };
    const resultCode = _parseJson(jsonString);

    // 6. 결과 출력
    console.log("---------------------------------------------------");
    console.log(`✅ 리팩토[단계: ${runStep}] 완료! 결과는 다음과 같습니다.`);
    console.log("==================================================");
    console.log(resultCode);

    // 파일 저장.
    if (runStep === "1") await saveCode('serviceCode', resultCode);
    else if (runStep === "2") await saveCode('apiCode', resultCode);

  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.error(
        `오류: 파일을 찾을 수 없습니다. 경로를 확인해주세요 (run 'refactor-prep.sh' in advance): ${runStep}`, error
      );
    } else {
      console.error("리팩토링 중 오류가 발생했습니다:", error);
    }
    process.exit(1);
  }
}

// runs locally.
refactorCode(process.argv).catch((e) => {
  console.error("! error:", e);
  process.exit(1);
});
