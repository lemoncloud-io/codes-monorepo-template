/**
 * Gemini API를 사용하여 TypeScript 코드를 리팩토링하는 스크립트(샘플)
 *
 * 사용법:
 * ```sh
 * # run step.1 in `prompt` folder.
 * npx ts-node refactor.ts 1
 *
 * # run with `backend` folder.
 * npx ts-node refactor.ts backend
 * ```
 */
import "dotenv/config"; // API 키를 .env 파일에서 로드
import { $ai, $fs } from "./lib/common";
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

// 메인 리팩토링 함수
async function refactorCode(args: string[]) {
  // 2. CLI 입력 파라미터로 파일 경로 받기
  const param1 = args[2];
  if (!param1) throw new Error(`리팩토링할 파일 경로를 입력해주세요. (입력: ${param1})`);

  const runType = /^[a-zA-Z][a-zA-Z0-9\-]*$/.test(param1) ? param1 : "prompt";
  const runStep = /^[0-9]+$/.test(param1) ? Number(param1) : 0;
  
  console.log(`Starting code refactoring for step[${runType}/${runStep}] ...`);

  const ai = $ai("GEMINI_API_KEY");
  const fs = $fs(runType, __dirname);

  try {
    // --- 프롬프트 설정 ---

    // 3. 프롬프트 빌드
    const SYSTEM_PROMPT = await fs.readFile(`${runType}/SYSTEM.md`);
    const USER_PROMPT = await fs.readFile(`${runType}/` + (runStep ? `USER-STEP${runStep}.md` : `USER.md`));
    const _loadCodes = async () => {
      const codes = fs.listCodeNames();
      // console.log(`> 로드할 코드 목록:`, codes?.join(', '));
      const results: Record<string, string> = {};
      for (const codeName of codes) {
        results[codeName] = await fs.loadCode(codeName).then(R => R ?? '').catch(e => `// Error: ${e?.message}`);
      }
      return results;
    }
    const prompt = fs.render(USER_PROMPT, await _loadCodes());

    console.log("--------------------------------------------------");
    console.log("🤖 Gemini에게 코드 리팩토링을 요청합니다...");
    console.log("==================================================");

    // 4. 호출 준비
    const params: GenerateContentParameters = {
      model: 1 ? "gemini-2.5-pro" : "gemini-pro",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0 ? 0.4 : 0.8,
        topP: 0.95,
        // maxOutputTokens: 2048, //WARN - may not work!
      },
    };
    fs.saveFile(`logs/params-${runType}${runStep ? '-' + runStep : ''}.yml`, params);

    // 5. 호출 실행
    const _genAI = async (params: GenerateContentParameters): Promise<GenerateContentResponse> => {
      // if (1) return null as any;
      if (0 && runType === 'simply') return await fs.readFile<any>('logs/result-simply-01.yml').then(R => {
        const text = R?.candidates?.[0]?.content?.parts?.[0].text ?? '';
        return { text } as any;
      });
      return await ai.models.generateContent(params);
    }
    const result = await _genAI(params);

    fs.saveFile(`logs/result-${runType}${runStep ? '-' + runStep : ''}.yml`, result);
    const jsonString = result?.text?.trim() ?? '';
    const resultCode = jsonString == '' ? '' : fs.parseResult(jsonString);

    // 6. 결과 출력
    console.log("--------------------------------------------------");
    console.log(`✅ 리팩토[단계: ${runStep}] 완료! 결과는 다음과 같습니다.`);
    console.log("==================================================");

    // 파일 저장.
    if (resultCode === '') {
      console.log("WARN! 리팩토링된 코드가 비어있습니다.");
    } else if (!resultCode) {
      throw new Error("리팩토링된 코드가 없습니다.");
    } else if (typeof resultCode === 'string' && runStep) {
      if (runStep === 1) await fs.saveCode('serviceCode', resultCode);
      else if (runStep === 2) await fs.saveCode('apiCode', resultCode);
      else throw new Error(`Unknown runStep: ${runStep}`);
    } else if (typeof resultCode === 'object') {
      //* update frontend
      if (resultCode.apiType) await fs.saveCode('apiType', resultCode.apiType);
      if (resultCode.apiCode) await fs.saveCode('apiCode', resultCode.apiCode);
      if (resultCode.apiService) await fs.saveCode('apiService', resultCode.apiService);
      //* update backend
      if (resultCode.appType) await fs.saveCode('appType', resultCode.appType);
      if (resultCode.appCode) await fs.saveCode('appCode', resultCode.appCode);
      if (resultCode.appService) await fs.saveCode('appService', resultCode.appService);
    }
    
    const $usage = result?.usageMetadata;
    if ($usage && typeof resultCode === 'object') (resultCode as any).$usage = $usage;
    else if (typeof resultCode === 'string') return { result: resultCode, $usage };
    return resultCode;
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
refactorCode(process.argv).then(R => {
  console.log(">> done ...............");
  console.log(R);
}).catch((e) => {
  console.error("! error:", e);
  process.exit(1);
});
