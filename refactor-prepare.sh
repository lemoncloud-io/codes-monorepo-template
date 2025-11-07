#!/bin/sh
# refactor-prepare.sh
# - 이 스크립트는 백엔드 코드 리팩토링을 준비하기 위한 사전 단계를 수행합니다.
# - 사용법: ./refactor-prepare.sh <name-in-sample-app>
# - 예시: ./refactor-prepare.sh ai-blog-title-generator

set -e  # 오류 발생 시 즉시 종료

echo "Starting pre-steps for backend code refactoring..."

if [ -z "$1" ]; then
  echo "Usage: $0 <name-in-sample-app>"
  exit 1
fi

APP_NAME="$1"
BACKEND_DIR="apps/backend"
PKG_JSON="$BACKEND_DIR/package.json"
APP_DIR="sample/$APP_NAME"
APP_SERVICES="$APP_DIR/services"
APP_TYPES="$APP_DIR/types.ts"
BACKEND_SOURCES="$BACKEND_DIR/src"
BACKEND_SERVICES="$BACKEND_DIR/src/services"

FRONTEN_DIR="apps/frontend"
FRONTEN_SOURCE="$FRONTEN_DIR/src"
FRONTEN_SERVICES="$FRONTEN_DIR/src/services"

# 1. package.json 수정 맟 설치
# ----------------------------------------------------------
echo "[1/4] Adding @google/genai to apps/backend/package.json..."

if [ ! -f "$PKG_JSON" ]; then
  echo "Error: $PKG_JSON not found."
  exit 1
fi

# 2. geminiService 파일 복사
# ----------------------------------------------------------
echo "[2/4] Copying geminiService.ts file..."

if [ -f "$APP_SERVICES/geminiService.ts" ]; then
  cp -rf "$APP_SERVICES/" "./$BACKEND_SERVICES/"
  cp -rf "$APP_SERVICES/" "./$FRONTEN_SERVICES/"
  echo "Copy gemini service file successful!"
  ls "$BACKEND_SERVICE/geminiService.ts" 2>/dev/null || echo "Copy to backend failed."
  ls "$FRONTEN_SERVICES/geminiService.ts" 2>/dev/null || echo "Copy to frontend failed."
else
  echo "Gemini Service file not exist → $APP_SERVICES"
fi

# 3. types.ts 파일 복사
# ----------------------------------------------------------
echo "[3/4] Copying types.ts file..."

if [ -f "$APP_TYPES" ]; then
  cp "$APP_TYPES" "./$BACKEND_SERVICES/types.ts"
  echo "Copy types file successful! (backend, frontend)"
  ls "$BACKEND_SERVICE/types.ts" 2>/dev/null || echo "Copy to backend failed."
else
  echo "Types file not exist → $APP_SERVICES"
fi

# 3. types.ts 파일 복사
# ----------------------------------------------------------
echo "[4/4] Copying file..."
if [ -d "$APP_DIR/utils" ]; then
  cp -rf "$APP_DIR/utils/" "./$BACKEND_SOURCES/utils/"
  cp -rf "$APP_DIR/utils/" "./$FRONTEN_SOURCES/utils/"
  echo "Copy utils folder successful! (backend, frontend)"
  ls "$BACKEND_SOURCES/utils" 2>/dev/null || echo "WARN! Copy to backend/utils failed."
  ls "$FRONTEN_SOURCES/utils" 2>/dev/null || echo "WARN! Copy to frontend/utils failed."
fi
if [ -d "$APP_DIR/components" ]; then
  cp -rf "$APP_DIR/components/" "./$FRONTEN_SOURCE/components/"
  echo "Copy components folder successful!"
  ls "$FRONTEN_SOURCE/components" 2>/dev/null || echo "WARN! Copy to frontend/components failed."
fi
if [ -d "$APP_DIR/services" ]; then
  cp -rf "$APP_DIR/services/" "./$FRONTEN_SOURCE/services/"
  echo "Copy services folder successful!"
  ls "$FRONTEN_SOURCE/services" 2>/dev/null || echo "WARN! Copy to frontend/services failed."
fi
if [ -f "$APP_DIR/constants.ts" ]; then
  cp -rf "$APP_DIR/constants.ts" "./$FRONTEN_SOURCE/"
  echo "Copy constants.ts successful!"
  ls "$FRONTEN_SOURCE/constants.ts" 2>/dev/null || echo "WARN! Copy to frontend/index.tsx failed."
fi
if [ -f "$APP_DIR/App.tsx" ]; then
  cp -rf "$APP_DIR/App.tsx" "./$FRONTEN_SOURCE/"
  echo "Copy App.tsx successful!"
  ls "$FRONTEN_SOURCE/App.tsx" 2>/dev/null || echo "Copy to frontend/App.tsx failed."
fi
if [ -f "$APP_DIR/index.tsx" ]; then
  cp -rf "$APP_DIR/index.tsx" "./$FRONTEN_SOURCE/"
  echo "Copy index.tsx successful!"
  ls "$FRONTEN_SOURCE/index.tsx" 2>/dev/null || echo "WARN! Copy to frontend/index.tsx failed."
fi
if [ -f "$APP_DIR/index.html" ]; then
  cp -rf "$APP_DIR/index.html" "./$FRONTEN_SOURCE/../index.html"
  echo "Copy index.html successful!"
  ls "$FRONTEN_SOURCE/../index.html" 2>/dev/null || echo "WARN! Copy to frontend/index.html failed."
  # GNU/BSD 간단 분기
  if sed --version >/dev/null 2>&1; then
    sed -i 's#/index\\.tsx#/src/index.tsx#g' "$FRONTEN_SOURCE/../index.html"
  else
    sed -i '' 's#/index\\.tsx#/src/index.tsx#g' "$FRONTEN_SOURCE/../index.html"
  fi
fi
if [ -f "$APP_DIR/types.ts" ]; then
  cp -rf "$APP_DIR/types.ts" "./$FRONTEN_SOURCE/"
  echo "Copy types.ts successful!"
  ls "$FRONTEN_SOURCE/types.ts" 2>/dev/null || echo "WARN! Copy to frontend/types.ts failed."
fi
if [ -f "$APP_DIR/metadata.json" ]; then
  cp -rf "$APP_DIR/metadata.json" "./$FRONTEN_SOURCE/"
  echo "Copy metadata.json successful!"
  ls "$FRONTEN_SOURCE/metadata.json" 2>/dev/null || echo "WARN! Copy to frontend/metadata.json failed."
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
