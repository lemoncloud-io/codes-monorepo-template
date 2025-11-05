#!/bin/bash
# backend-backend.sh
# - 이 스크립트는 백엔드 코드 리팩토링을 준비하기 위한 사전 단계를 수행합니다.
# - 사용법: ./backend-refactor-prep.sh <name-in-sample-app>
# - 예시: ./backend-refactor-prep.sh ai-blog-title-generator

set -e  # 오류 발생 시 즉시 종료

# move into refactor directory
cd ./refactor

# Define the log file path
LOG_DIR="../refactor/logs"
LOG_FILE="${LOG_DIR}/refactor-backend.log"

# Create the log directory if it doesn't exist (forcibly)
mkdir -p "$LOG_DIR"

# Redirect all script output (stdout and stderr) to the log file
# The 'tee' command also prints to the console while writing to the file
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Starting steps for backend code refactoring..."

# 리팩토링 스크립트 실행
# ----------------------------------------------------------
echo "[1/2] Running refactor.ts for backend code..."
# npx ts-node refactor.ts 1 2>&1 | tee -a "$LOG_FILE"
npx ts-node refactor.ts backend 2>&1 | tee -a "$LOG_FILE"

echo "Code refactoring completed."

cd ..