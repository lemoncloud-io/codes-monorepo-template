/**
 * Gemini API를 사용하여 TypeScript 코드를 리팩토링하는 스크립트(샘플)
 * 
 * 사용법:
 * ```sh
 * npx ts-node main.ts example.ts
 * ```
 */
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import "dotenv/config"; // API 키를 .env 파일에서 로드
import { asYml } from "./lib/yml";

// Factory 함수로 Gemini AI 인스턴스 생성
const $ai = ((API_KEY: string) => {
    if (!process.env[API_KEY]) {
    throw new Error(`${API_KEY} environment variable not set`);
    }
    const ai = new GoogleGenAI({ apiKey: process.env[API_KEY] });
    return ai;
})('GEMINI_API_KEY');

/** save file */
const saveFile = async (filePath: string, content: string | object, baseRoot?: string) => {
  filePath = baseRoot ? path.join(baseRoot, filePath) : filePath;
  filePath = path.resolve(filePath);
  if (typeof content === "object") content = asYml(content);

  if (!(await fs.lstat(path.dirname(filePath))).isDirectory())
    await fs.mkdir(path.dirname(filePath), { recursive: true });

  return fs.writeFile(filePath, content, "utf-8");
};

// --- 프롬프트 설정 ---
// 추가적인 시스템 레벨의 지시사항을 설정할 수 있습니다.
const SYSTEM_PROMPT = `
You are an expert code refactoring assistant.
Your task is to refactor the given TypeScript code based on the provided rules.
The output should be only the refactored code block itself, without any additional explanations or markdown formatting.
`;

// 메인 리팩토링 함수
async function refactorCode() {

  // 2. CLI 입력 파라미터로 파일 경로 받기
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("리팩토링할 파일 경로를 입력해주세요. 예: ts-node refactor.ts example.ts");
    process.exit(1);
  }

  try {
    // 3. 필요한 파일들 읽기 (GEMINI.md, 대상 코드)
    const refactorRules = await fs.readFile(path.join(__dirname, "GEMINI.md"), "utf-8");
    const codeToRefactor = await fs.readFile(path.resolve(filePath), "utf-8");

    // 4. Gemini에게 보낼 프롬프트 구성
    const prompt = `
${refactorRules}

---

다음은 리팩토링할 코드입니다. 위의 규칙에 따라 코드를 개선해주세요.

\`\`\`typescript
${codeToRefactor}
\`\`\`
`;

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
    saveFile('logs/main-response.yml', result);
    const jsonString = result?.text?.trim();
    const _parseJson = (txt: any) => {
        try {
            const match = typeof txt === 'string' ? txt.match(/^```(?:typescript|ts)?\s*\n?([\s\S]*?)\n?```[\s\n]*$/) : null;
            if (match) {
                txt = match[1];
            } else if (typeof txt === 'string' && txt.startsWith("```") && txt.endsWith("```")) {
                const lines = txt.split('\n');
                lines.shift(); // 첫 번째 줄 제거 (```typescript)
                lines.pop();   // 마지막 줄 제거 (```)
                txt = lines.join('\n').trim();
                return txt;
            }
            return JSON.parse(txt || "");
        } catch (e) {
            console.log(jsonString);
            console.error("! JSON 파싱 오류:", e);
            return null;
        }
    }
    const resultCode = _parseJson(jsonString);

    // 6. 결과 출력
    console.log("---------------------------------------------------");
    console.log("✅ 리팩토링 완료! 결과는 다음과 같습니다.");
    console.log("==================================================");
    console.log(resultCode);

  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error(`오류: 파일을 찾을 수 없습니다. 경로를 확인해주세요: ${filePath}`);
    } else {
        console.error("리팩토링 중 오류가 발생했습니다:", error);
    }
    process.exit(1);
  }
}

// runs locally.
refactorCode();
