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
import mustache from "mustache";
import { $ai, $fs } from "./common";

// 메인 리팩토링 함수
async function refactorCode(args: string[]) {
  // 2. CLI 입력 파라미터로 파일 경로 받기
  const param1 = args[2];
  if (!param1) throw new Error(`리팩토링할 파일 경로를 입력해주세요. (입력: ${param1})`);

  const runType = /^[a-zA-Z][a-zA-Z0-9\-]*$/.test(param1) ? param1 : "prompt";
  const runStep = /^[0-9]+$/.test(param1) ? Number(param1) : 0;

  console.log(`Starting code refactoring for step[${runType}/${runStep}] ...`);

  //* for test.
  // if (runType == 'backend'){
  //   const result = await $fs.readFile('sample/result-backend.yml');
  //   console.log("==================================================");
  //   const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  //   console.log($fs.parseResult(text));
  //   return;
  // }

  try {
    // --- 프롬프트 설정 ---
    const SYSTEM_PROMPT = await $fs.readFile(`${runType}/SYSTEM.md`);
    const USER_PROMPT = await $fs.readFile(`${runType}/` + (runStep ? `USER-STEP${runStep}.md` : `USER.md`));
    const [serviceCode, typeCode, apiCode] = await Promise.all([
      $fs.loadCode("serviceCode"),
      $fs.loadCode("typeCode"),
      $fs.loadCode("apiCode"),
    ]);
    const prompt = mustache.render(USER_PROMPT, {
      serviceCode,
      typeCode,
      apiCode,
    });

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
    $fs.saveFile(`logs/result-${runType}${runStep ? '-' + runStep : ''}.yml`, result);
    const jsonString = result?.text?.trim();
    const resultCode = $fs.parseResult(jsonString);

    // 6. 결과 출력
    console.log("---------------------------------------------------");
    console.log(`✅ 리팩토[단계: ${runStep}] 완료! 결과는 다음과 같습니다.`);
    console.log("==================================================");
    console.log(resultCode);

    // 파일 저장.
    if (!resultCode) {
      throw new Error("리팩토링된 코드가 없습니다.");
    } else if (typeof resultCode === 'string' && runStep) {
      if (runStep === 1) await $fs.saveCode('serviceCode', resultCode);
      else if (runStep === 2) await $fs.saveCode('apiCode', resultCode);
      else throw new Error(`Unknown runStep: ${runStep}`);
    } else if (typeof resultCode === 'object') {
      if (resultCode.serviceCode) await $fs.saveCode('serviceCode', resultCode.serviceCode);
      if (resultCode.typeCode) await $fs.saveCode('typeCode', resultCode.typeCode);
      if (resultCode.apiCode) await $fs.saveCode('apiCode', resultCode.apiCode);
    }

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
