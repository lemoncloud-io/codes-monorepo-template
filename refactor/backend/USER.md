# 리팩토링 작업

파일 구조와 단계에 맞춰서, 최종 코드를 만들어 줍니다.

## Architecture

```txt
┌───────────────────────────────────────────────┐
│       Monorepo Root (npm workspace)           │
└───────────────────────────────────────────────┘
                      │
          ┌───────────┴────────────┐
          │                        │ 
          ▼                        ▼ 
  ┌──────────────────┐    ┌──────────────────┐
  │  backend         │    │  frontend        │
  │  lemon-core API  │◄───┤  React SPA       │
  │  Port: 8000      │    │  Port: 3000      │
  └──────────────────┘    └──────────────────┘
```

## 파일 구조 및 리팩토링 사항

| 작업 단계 | 파일 경로 (Source) | 작업 내용 |
|------|------------|-----------|
| **1** | `apps/backend/src/services/geminiService.ts` | **(Service 시그니처 리팩토링)** 유저 프롬프트에 `apps/backend/src/services/types.ts` 코드가 포함된 경우에만 상단에 **`./types`타입 import** 코드를 추가합니다. App의 메인 함수에 인풋 파라미터가 존재할 경우, 이를 단일 객체(`$param: { name: string }` 예시)로 변경하고, 내부 참조를 `$param?.name`(예시) 형태로 수정합니다. |
| **2** | `apps/backend/src/api/hello-api.ts` | **(API 작성)** **`../services/geminiService`의 메인 함수를 import**합니다. API 함수명은 항상 **`doPostGenerate`**로 하며, HTTP URL은 **`hello/:id/generate`** 형식으로 지정합니다. `:id` 값은 `geminiService.ts`의 메인 함수명을 camelCase -> dash-case로 변환하여 사용합니다. `doPostGenerate` 내에서 if 문으로 `:id`별 분기 로직을 작성합니다. body에서 필요한 값을 추출해 `$param` 객체를 생성하고, 이를 메인 함수에 전달하여 실행 결과를 반환합니다. |

> **⚠️ [올바른 import 방법 - 프로젝트 내 모든 파일 간 import에 적용]**
> ※ 라이브러리 import(`@google/genai` 등)는 해당 없음. **프로젝트 내 파일 간 import만 적용!**
> 1. import하려는 **메서드명 + 파일명**으로 프로젝트 내 검색
> 2. 메서드가 실제로 해당 파일에 존재하는지 확인
> 3. 존재하면, **현재 파일 기준 상대 경로**를 계산하여 import
> 4. 예시: `hello-api.ts`에서 `services/geminiService.ts`의 함수 import → `'../services/geminiService'`

**[사전 검증 (Preflight) — 단계별 필수 조건 및 불충족 시 동작]**
● 1단계 (Service 리팩토링)

- **필수 파일:** `apps/backend/src/services/geminiService.ts`
- 파일이 존재하지 않거나 메인 함수 자체가 없으면 -> **아무것도 출력하지 않습니다.** (빈 응답)
- `API_KEY`를 환경변수에서 이용할 경우, `GEMINI_API_KEY`의 환경변수로도 이용할 수 있도록 변경 (ex: `process.env.API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;`)
- **(SDK 버전 주의)** `@google/genai` 패키지는 `GoogleGenAI`를 export합니다. 구버전 패턴(`@google/generative-ai`)이 있으면 반드시 신버전 패턴으로 변경하세요.

  **[구버전→신버전 변환 규칙]**

  | 구버전 (`@google/generative-ai`) | 신버전 (`@google/genai`) |
  |--------------------------------|-------------------------|
  | `import { GoogleGenerativeAI }` | `import { GoogleGenAI }` |
  | `new GoogleGenerativeAI(apiKey)` | `new GoogleGenAI({ apiKey })` |
  | `genAI.getGenerativeModel({ model })` | ❌ 사용하지 않음 |
  | `model.generateContent(prompt)` | `ai.models.generateContent({ model, contents })` |
  | `generationConfig: { ... }` | `config: { ... }` |
  | `result.response` | ❌ 사용하지 않음 (response 직접 반환) |
  | `response.text()` | `response.text` (메서드→속성) |
  | `gemini-pro`, `gemini-1.5-flash` 등 | `gemini-2.5-flash` (**model은 필수 파라미터!**) |
  | `role: "system"` 등 잘못된 role | `role: "user"` 또는 `role: "model"` 만 허용 |

  **(model 필수!)** `model` 파라미터는 **절대 생략 불가**! 반드시 `model: "gemini-2.5-flash"` 이상을 명시하세요. 구버전(`gemini-1.5-flash`, `gemini-pro`)은 **404 에러** 발생!
  **(role 필수)** contents의 role은 `"user"` 또는 `"model"`만 허용됩니다. `"system"` 등 다른 값은 **400 에러** 발생!

  **(구문 주의)** import 경로 및 문자열은 반드시 **일반 따옴표(`'` 또는 `"`)** 를 사용하세요. 백틱(\`)은 import 경로에 사용 금지!
  - ✅ `import { GoogleGenAI } from "@google/genai";`
  - ❌ `import { GoogleGenAI } from \`@google/genai\`;` ← **구문 에러 발생**

  **[GoogleGenAI 사용예제]**

  ```ts
  import { GoogleGenAI } from "@google/genai";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    config: { responseMimeType: "application/json" },  // generationConfig 대신 config 사용
  });
  console.log(response.text);  // .text() 가 아닌 .text 속성 사용
  ```

- **선택 파일:** `apps/backend/src/services/types.ts`  
- 파일이 존재하지 않는 경우 → **상단에 `./types`타입 import 코드를 추가하지 않으며**, `$param` 구조 리팩토링만 수행합니다.

- **메인 함수 파라미터 검증:**  
- 메인 함수가 **인풋을 받지 않을 경우**, 단일 객체(`$param`)로 변경할 필요가 없습니다.  

- **변경 필요성 검증:**  
- 타입 import 불필요 + `$param` 구조 리팩토링이 불필요한 경우 → **아무것도 변경하지 않고 기존 코드를 그대로 출력합니다.**

● 2단계 (API 작성)

- **전제 조건:**  
- 1단계에서 리팩토링된 `apps/backend/src/services/geminiService.ts`의 **메인 함수 결과물**이 반드시 존재해야 합니다.  
- `geminiService.ts`가 없거나, `geminiService.ts`가 존재해도 이전 1단계의 결과 코드가 없는 경우(메인함수가 없는 경우),
    → `import`문을 포함하여 **API 작성 자체를 수행하지 않습니다.** (빈 응답)

- **API 작성 목적:**  
- API는 Service의 메인 함수를 호출하기 위한 진입점입니다.  
- 연결할 Service 함수가 존재하지 않으면, **API 생성 목적이 성립하지 않으므로 아무것도 출력하지 않습니다.**

-------

## 기존 코드

다음은 리팩토링할 코드입니다. 위의 규칙에 따라 코드를 개선해주세요.

- 파일 경로에 `@`를 붙여서, 파일별로 코드 구분함.

@apps/backend/src/services/geminiService.ts

```typescript
{{{apiService}}}
```

@apps/backend/src/services/types.ts

```typescript
{{{apiType}}}
```

@apps/backend/src/api/hello-api.ts

- `HelloAPIController` 가 정의된 기존 API 파일

```typescript
{{{apiCode}}}
```
