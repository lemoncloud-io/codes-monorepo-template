#!/bin/sh

set -e  # 오류 발생 시 즉시 종료

echo "Starting pre-steps for backend code refactoring..."

BACKEND_DIR="apps/backend"
PKG_JSON="$BACKEND_DIR/package.json"
APP_DIR="sample/ai-blog-title-generator"
APP_SERVICES="$APP_DIR/services/geminiService.ts"
APP_TYPES="$APP_DIR/types.ts"
BACKEND_SERVICES="$BACKEND_DIR/src/services"
FRONTEN_DIR="apps/frontend"
FRONTEN_SERVICES="$FRONTEN_DIR/src"

# 1. package.json 수정 맟 설치
# ----------------------------------------------------------
echo "[1/4] Adding @google/genai to apps/backend/package.json..."

if [ ! -f "$PKG_JSON" ]; then
  echo "Error: $PKG_JSON not found."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed. (macOS: brew install jq, Ubuntu: sudo apt install jq)"
  exit 1
fi

# Add @google/genai to dependencies
TEMP_FILE=$(mktemp)
jq '(.dependencies //= {}) | .dependencies["@google/genai"] = "^1.25.0"' "$PKG_JSON" > "$TEMP_FILE" && mv "$TEMP_FILE" "$PKG_JSON"
echo "package.json 업데이트 완료 (@google/genai:^1.25.0)"
    echo "package.json update successful!"

# pnpm install
cd "$BACKEND_DIR"
if pnpm install; then
  echo "pnpm install successful!"

else
  echo "pnpm install Failed. Script exits."
  exit 1
fi
cd ../..

# 2. geminiService 파일 복사
# ----------------------------------------------------------
echo "[2/4] Copying geminiService.ts file..."

if [ -f "$APP_SERVICES" ]; then
  cp "$APP_SERVICES" "./$BACKEND_SERVICES/geminiService.ts"
  echo "Copy gemini service file successful!"
  ls "$BACKEND_SERVICE/geminiService.ts" 2>/dev/null || echo "Copy to backend failed."
else
  echo "Gemini Service file not exist → $APP_SERVICES"
fi

# 3. types.ts 파일 복사
# ----------------------------------------------------------
echo "[3/4] Copying types.ts file..."

if [ -f "$APP_TYPES" ]; then
  cp "$APP_TYPES" "./$BACKEND_SERVICES/types.ts"
  cp "$APP_TYPES" "./$FRONTEN_SERVICES/types.ts"
  echo "Copy types file successful! (backend, frontend)"
  ls "$BACKEND_SERVICE/types.ts" 2>/dev/null || echo "Copy to backend failed."
  ls "$FRONTEN_SERVICES/types.ts" 2>/dev/null || echo "Copy to frontend failed."
else
  echo "Types file not exist → $APP_SERVICES"
fi

# 4. 필수 파일 존재 확인
# ----------------------------------------------------------
echo "Checking for existence of required files..."

check_exists() {
  if [ -e "$1" ]; then
    echo "Exist: $1"
  else
    echo "Not Exist: $1"
  fi
}

# install 필수
check_exists "apps/backend/package.json"
check_exists "apps/backend/node_modules"

# 서비스 및 타입 파일
check_exists "apps/backend/src/services"
check_exists "apps/backend/src/services/geminiService.ts"
check_exists "apps/backend/src/services/types.ts"
check_exists "apps/frontend/src/types.ts"

echo "All pre-steps completed!"
