# 리팩토링

파일 구조와 단계에 맞춰서, 최종 코드를 만들어 줍니다.

AI Studio에서 만들어진 `geminiService.ts` 파일의 주요 로직이 백엔드 서버쪽에서 돌아갈 수 있도록 리팩토링 해줍니다.

그리고 프론트(React)에서는 백엔드의 API 호출을 통해서 서로 연결됩니다.

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

### 파일 구조

`apps` 폴더안에 백엔드(backend)부분과 프론트(fronend) 코드가 하나의 저장소에서 분리되어 있음.

```tree
apps
 │-- backend
 │ │-- handler.js
 │ │-- package.json
 │ └-- src
 │   │-- api
 │   │ └-- hello-api.ts
 │   │-- express.ts
 │   │-- index.ts
 │   └-- service
 │   │ │-- model.ts
 │   │ │-- service.ts
 │   │ │-- types.ts
 │   │ └-- views.ts
 │   └-- services
 │     └-- geminiService.ts
 └-- frontend
   │-- index.html
   │-- package.json
   └-- src
     │-- App.tsx
     │-- api
     │ └-- axios.tsx
     └-- services
     │ └-- geminiService.ts
     └-- index.tsx
 ```

## 리팩토링 작업 단계

각 단계별로 작업 계획을 세워서 진행합니다.

**[사전작업]** AI Studio 의 결과물은 zip으로 되어 있으며, 별도 외부 프로그램을 이용해서 zip 파일내 코드가 `파일 구조`내 폴더로 각기 복사되어 집니다.

**[작업목표]** 리팩토링 작업이 필요한 부분에 대해서는 아래의 `## 기존 코드` 섹션에 설명되며, 각 파일별 주요 변경 전략은 다음과 같습니다.

### 작업 1단계: 프론트엔드

> 프론트에서의 리팩토링 주요 작업은 `geminiService.ts` 코드내 함수를 서버 API로 변경합니다.
> `@google/genai` 와 관련된 작업을 백엔드에서 처리하므로, 프론트에서는 API 호출하는 것으로 개선합니다.

1. `apps/frontend/src/types.ts` 파일 작업

- `types.ts`은 타입 정보 참고용으로 원본 그대로 유지함 -> **아무것도 출력하지 않습니다.** (빈 응답)

2. `apps/frontend/src/services/geminiService.ts` 파일 작업

- **(axios 지원)** 헤더에 `import apiClient from '../api/axios'` 를 추가하여 API 요청 준비함.
- **(Service 시그니처 리팩토링)** 함수에 인풋 파라미터를 단일 객체(예시 `$body: { name: string }`)로 패키징시켜서 API 호출용 `$body`를 준비합니다. 그리고 리턴타입에 맞춘 API 호출로 변경합니다(단, 함수의 파라미터와 리턴 타입은 **절대** 변경하지 않습니다)
- `GoogleGenAI` 실행은 백엔드에서 하므로, 여기에서는 `import { GoogleGenAI } from "@google/genai"` 를 포함한 관련된 코드를 정리해줍니다.
- **(API 연동작업)** 매칭되는 API HTTP Endpoint는  **`/hello/:id/generate`** 형식으로 지정합니다. `:id` 값은 `geminiService.ts`의 메인 함수명을 camelCase -> `dash-case` 로 변환하여 사용합니다. body에서 필요한 값을 추출해 `$body` 객체를 생성하고, 이를 API 요청에 대한 body로 사용합니다. (예시: `apiClient.post<ReturnType>('/hello/say-hello/generate', $body)`)
- `types.ts` 파일이 존재하지 않거나 비어있는 경우 → **상단에 `./types` 타입 import 코드를 추가하지 않으며**, `$body` 구조 리팩토링만 수행합니다.
- **(중요)** 절대! 원본 함수의 입력과 출력은 그대로 유지하여야 하며, `apiClient`를 이용한 호출로 변경합니다. `apiClient`의 호출시 응답 결과는 `data` 속성에 있음.

**[예제코드]**

  ```typescript
  function async sayHello(name: string, age?: number): Promise<ReturnType>{
    const $body = { name, age };
    const path = `/hello/say-hello/generate`;
    const response = await apiClient.post<ReturnType>(path, $body);
    return response?.data as ReturnType;
  }
  ```

- **(파일이용)** 서비스 함수내에서 파일을 참조할 경우, 이를 읽어서 base64로 인코딩된 `MediaData`로 변환하여 이용합니다. (예: `type interface MediaData { base64: string mimeType: string; }`) 파일를 `MediaData`로 변환하는 샘픔 코드는 아래의 `예제코드`를 참고합니다.

  **[예제코드]**

  ```ts
  export interface MediaData {
    /** base64 encoded data */    
    base64: string;
    /** mime-type of media */
    mimeType: string;
  }
  export const fileToMediaData = (file: File): Promise<MediaData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // The result is 'data:image/jpeg;base64,LzlqLz...', we only need the part after the comma.
        const base64 = result.split(',')[1];
        const mimeType = file.type;
        if (!base64 || !mimeType) {
          reject(new Error("Failed to read file details"));
          return;
        }
        resolve({ base64, mimeType });
      };
      reader.onerror = (error) => reject(error);
    });
  };
  ```

3. `apps/frontend/src/App.tsx` 파일 작업

- 보통은 `geminiService.ts`내의 함수 사용을 참고용을 -> **아무것도 출력하지 않습니다.** (빈 응답)
- 단, `geminiService.ts` 함수의 파라미터 변경시 호출 부분에서 함께 변경 필요함!

> **⚠️ [import 경로 필수 확인]** `App.tsx`에서 `geminiService` import 시 경로를 **반드시** 확인하세요!
> - ✅ **올바른 경로**: `import { 함수명 } from './services/geminiService';`
> - ❌ **잘못된 경로**: `import { 함수명 } from './geminiService';` ← **빌드 에러 발생!**

### 작업 2단계: 백엔드

> 백엔드에서의 리팩토링 주요 작업은 `hello-api.ts` 와 `geminiService.ts` 코드내 함수의 연결입니다.
> **절대** 반드시 `@google/genai` 패키지의 `GoogleGenAI`를 이용하는 기존 코드는 그대로 유지합니다 → **GoogleGenAI() 사용 코드 유지**
> **주의** `geminiService.ts` 코드내 함수들의 파라미터 변경만 적용합니다.
> **(SDK 버전 주의)** `@google/genai` 패키지는 `GoogleGenAI`를 export합니다. 구버전 패턴(`@google/generative-ai`)이 있으면 반드시 신버전 패턴으로 변경하세요.

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
  | `gemini-pro`, `gemini-1.5-flash` 등 | `gemini-2.5-flash` 이상 또는 model 파라미터 생략 |
  | `role: "system"` 등 잘못된 role | `role: "user"` 또는 `role: "model"` 만 허용 |

  **(모델명 필수)** `gemini-1.5-flash`, `gemini-pro` 등 구버전 모델명은 **404 에러** 발생! `gemini-2.5-flash` 이상 사용하거나 model 파라미터를 생략하세요 (default 사용).
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

1. `apps/backend/src/services/types.ts` 파일 작업

- `types.ts`은 타입 정보 참고용으로 원본 그대로 유지함 -> **아무것도 출력하지 않습니다.** (빈 응답)

2. `apps/backend/src/services/geminiService.ts` 파일 작업

- **(Service 시그니처 리팩토링)** 유저 프롬프트에 `apps/backend/src/services/types.ts` 코드가 포함된 경우에만 상단에 **`./types`타입 import** 코드를 추가합니다.
- **(환경변수)** `API_KEY`를 환경변수에서 이용할 경우, `GEMINI_API_KEY`의 환경변수로도 이용할 수 있도록 변경 (ex: `process.env.API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;`)
- **(파라미터 재작성)** App의 메인 함수에 인풋 파라미터가 존재할 경우, 이를 단일 객체(`$param: { name: string }` 예시)로 변경하고, 내부 참조를 `$param?.name`(예시) 형태로 수정합니다.
- **(메인 함수 파라미터 검증)** 메인 함수가 **인풋을 받지 않을 경우**, 단일 객체(`$param`)로 변경할 필요가 없습니다.
- **(변경 필요성 검증)** 타입 import 불필요 + `$param` 구조 리팩토링이 불필요한 경우 → **아무것도 변경하지 않고 기존 코드를 그대로 출력합니다.**
- `types.ts` 파일이 존재하지 않거나 비어있는 경우 → **상단에 `./types`타입 import 코드를 추가하지 않으며**, `$param` 구조 리팩토링만 수행합니다.

3. `apps/backend/src/api/hello-api.ts` 파일 작업

- **(import하기)** **`../services/geminiService`의 메인 함수를 import** 합니다.
- **(API 연결)** API 함수명은 항상 **`doPostGenerate`**로 하며, HTTP URL은 **`hello/:id/generate`** 형식으로 지정합니다.
- `:id` 값은 `geminiService.ts`의 메인 함수명을 camelCase -> dash-case로 변환하여 사용합니다.
- **(:id 연결)** `doPostGenerate` 내에서 if 문으로 `:id`별 분기 로직을 작성합니다. body에서 필요한 값을 추출해 `$param` 객체를 생성하고, 이를 메인 함수에 전달하여 실행 결과를 반환합니다.

**[API 작성 목적]**  

- API는 Service의 메인 함수를 호출하기 위한 진입점입니다.  
- 연결할 Service 함수가 존재하지 않으면, **API 생성 목적이 성립하지 않으므로 아무것도 출력하지 않습니다.**

-------

## 기존 코드

다음은 리팩토링할 코드입니다. 위의 규칙에 따라 코드를 개선해주세요.

- 파일 경로에 `@`를 붙여서, 파일별로 코드 구분함.

@apps/frontend/src/types.ts

- 원본 Type 정의 파일

```typescript
{{{appType}}}
```

@apps/frontend/src/services/geminiService.ts

- AI Studio에서 만들어진 원본 `geminiService.ts` 파일 (복사됨)

```typescript
{{{appService}}}
```

@apps/frontend/src/App.tsx

- AI Studio에서 만들어진 원본 `App.tsx` 파일 (복사됨)

```typescript
{{{appCode}}}
```

@apps/backend/src/services/types.ts

- 원본 Type 정의 파일

```typescript
{{{apiType}}}
```

@apps/backend/src/services/geminiService.ts

- AI Studio에서 만들어진 원본 `geminiService.ts` 파일 (복사됨)

```typescript
//! @apps/frontend/src/services/geminiService.ts 파일과 같음 
```

@apps/backend/src/api/hello-api.ts

- `HelloAPIController` 가 정의된 기존 API 파일

```typescript
{{{apiCode}}}
```
