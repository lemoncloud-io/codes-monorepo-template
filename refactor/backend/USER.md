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
| **1** | `apps/backend/src/services/geminiService.ts` | **(Service 시그니처 + AI 호출 구조 리팩토링)** 유저 프롬프트에 `apps/backend/src/services/types.ts` 코드가 포함된 경우에만 상단에 **`./types`타입 import** 코드를 추가합니다. App의 메인 함수에 인풋 파라미터가 존재할 경우, 이를 단일 객체(`$param: { name: string }` 예시)로 변경하고, 내부 참조를 `$param?.name`(예시) 형태로 수정합니다. 또한 Gemini SDK 직접 호출 코드를 `eureka-agents-api` 중계 호출 방식으로 변경합니다. |
| **2** | `apps/backend/src/api/hello-api.ts` | **(API 작성)** **`../services/geminiService`의 메인 함수를 import**합니다. API 함수명은 항상 **`doPostGenerate`**로 하며, HTTP URL은 **`hello/:id/generate`** 형식으로 지정합니다. `:id` 값은 `geminiService.ts`의 메인 함수명을 camelCase -> dash-case로 변환하여 사용합니다. `doPostGenerate` 내에서 if 문으로 `:id`별 분기 로직을 작성합니다. body에서 필요한 값을 추출해 `$param` 객체를 생성하고, 이를 메인 함수에 전달하여 실행 결과를 반환합니다. |

## AI 중계 리팩토링 규칙

- `apps/backend/src/services/geminiService.ts` 에서 `@google/genai`, `GoogleGenAI`, `new GoogleGenAI({ apiKey: ... })` 직접 사용을 제거합니다.
- 서비스 내부 AI 호출은 반드시 `eureka-agents-api`의 `POST /agents/!gemini/generate`를 사용합니다.
- URL은 `\${baseUrl}/agents/!gemini/generate` 형태로 구성합니다. (`baseUrl` 예: `process.env.AGENTS_API_BASE_URL`)
- HTTP method는 `POST`, `Content-Type: application/json` 을 사용합니다.
- 요청 body는 `api-agents.ts`의 `GenAIRequestBody` 규격에 맞춰 필요 시 아래 키를 전달합니다: `system`, `prompt`, `input`, `model`, `temperature`, `topP`, `image`, `config`, `connectionId`.
- JSON 출력이 필요한 경우 `config.responseMimeType = "application/json"` 및 `config.responseSchema`를 유지합니다.
- 이미지 생성은 `image=true`와 이미지 모델을 사용하고, 응답의 `candidate.content.parts[].inlineData.data`를 `data:image/...;base64,...` 형태로 변환합니다.
- 텍스트/JSON 생성 응답은 `output.content`를 우선 파싱하고, 필요 시 빈 값 fallback 처리를 포함합니다.
- 앱 코드에서 `process.env.GEMINI_API_KEY`를 직접 사용하지 않습니다.
- Gemini API key는 `eureka-agents-api` 서버 환경에서만 관리된다고 가정하고, 앱에서 `geminiApiKey` override는 전달하지 않습니다.
- 서비스 설정 타입(`GeminiServiceConfig`)은 `apiKey` 중심이 아니라 `eureka-agents-api` 호출에 필요한 설정(예: `baseUrl`, `authHeader`) 중심으로 리팩토링합니다.
- 앱 환경변수 표준은 `AGENTS_API_BASE_URL`, `AGENTS_API_KEY`를 사용합니다.
- 최종 결과 코드에 Gemini SDK import/init 흔적이 남아 있으면 안 됩니다.

### 결정된 구현 패턴 (반드시 그대로 적용)

- `geminiService.ts`는 Gemini 스타일 인터페이스를 유지해야 합니다.
- 즉, 내부에 `private ai`를 두고 `this.ai.models.generateContent(...)`를 호출하는 형태를 유지합니다.
- 단, `ai`의 구현체는 Gemini SDK가 아니라 agents-api 어댑터여야 합니다.
- agents-api 호출 로직(fetch, headers, body mapping, error handling)은 **반드시 `geminiService.ts` 내부(private method/helper)** 에 포함합니다.
- `apps/backend/src/services/agents.ts` 같은 **별도 agents 전용 파일을 생성하지 않습니다.**
- 어댑터는 아래 변환 체인을 반드시 따릅니다:
- `기존 Gemini 호출 입력 -> agents 요청 body 변환 -> /agents/!gemini/generate 호출 -> agents 응답 수신 -> Gemini 유사 응답 형태로 재변환`
- `analyzeMarkdown()`과 `generateImage()`의 공개 메서드 시그니처는 기존을 유지합니다.
- `hello-api.ts`는 서비스 메서드 실행 진입점만 담당하고, AI provider 관련 로직(API key, model selection, SDK 호출)을 가지지 않습니다.
- `hello-api.ts`에서 `GeminiService` 초기화 시 `baseUrl`은 `process.env.AGENTS_API_BASE_URL`를 사용하고, `authHeader`는 `process.env.AGENTS_API_KEY`가 있을 때만 `Bearer ${process.env.AGENTS_API_KEY}`로 구성합니다.

### eureka-agents-api 호출 definition (반드시 준수)

```ts
POST {baseUrl}/agents/!gemini/generate
Body: {
  system?: string | { content: string };
  prompt?: string | { content: string };
  input?: string;
  model?: string;
  temperature?: string | number;
  topP?: string | number;
  image?: boolean;
  config?: Record<string, unknown>;
  connectionId?: string;
}
```

```ts
// text/json
const content = response.output?.content;

// image
const parts = response.candidate?.content?.parts ?? [];
const inline = parts.find((p: any) => p?.inlineData?.data)?.inlineData;

// model (api-agents.ts는 최종 응답에 model을 포함해 반환)
const usedModel = response.model;
```

**[사전 검증 (Preflight) — 단계별 필수 조건 및 불충족 시 동작]**
● 1단계 (Service 리팩토링)

- **필수 파일:** `apps/backend/src/services/geminiService.ts`  
- 파일이 존재하지 않거나 메인 함수 자체가 없으면 -> **아무것도 출력하지 않습니다.** (빈 응답)
- 기존에 `API_KEY`, `GEMINI_API_KEY`를 앱 코드에서 직접 사용하던 로직이 있으면 제거하고, `eureka-agents-api` 호출 설정값 기반으로 변경합니다.
- `eureka-agents-api` 호출 코드(`POST /agents/!gemini/generate`)가 결과물에 없으면 리팩토링이 완료된 것으로 간주하지 않습니다.
- 아래 3개 파일 중 하나라도 누락되면 리팩토링이 완료된 것으로 간주하지 않습니다:
- `apps/backend/src/services/geminiService.ts`
- `apps/backend/src/services/types.ts`
- `apps/backend/src/api/hello-api.ts`
- `GeminiServiceConfig`에 `baseUrl: string`이 없으면 실패로 간주합니다.

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

## 최종 셀프체크 (출력 전 필수)

- `@google/genai` import 가 결과 코드에 존재하지 않는지 확인
- `new GoogleGenAI(` 문자열이 결과 코드에 존재하지 않는지 확인
- `process.env.GEMINI_API_KEY` 직접 사용이 결과 코드에 존재하지 않는지 확인
- `POST /agents/!gemini/generate` 호출이 `geminiService.ts`에 존재하는지 확인
- `AGENTS_API_BASE_URL`, `AGENTS_API_KEY` 기반 설정이 `hello-api.ts`에 반영되었는지 확인
