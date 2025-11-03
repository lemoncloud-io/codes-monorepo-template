#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("Starting pre-steps for backend code refactoring...");

const ROOT_DIR = process.cwd();
const BACKEND_DIR = path.join(ROOT_DIR, "apps/backend");
const PKG_JSON = path.join(BACKEND_DIR, "package.json");
const APP_DIR = path.join(ROOT_DIR, "sample/ai-blog-title-generator");
const APP_SERVICES = path.join(APP_DIR, "services");
const APP_TYPES = path.join(APP_DIR, "types.ts");
const BACKEND_SERVICES_DIR = path.join(BACKEND_DIR, "src/services");
const FRONTEND_DIR = path.join(ROOT_DIR, "apps/frontend");
const FRONTEND_SERVICES_DIR = path.join(FRONTEND_DIR, "src");

function checkExists(filePath) {
    if (fs.existsSync(filePath)) {
        console.log(`Exist: ${path.relative(ROOT_DIR, filePath)}`);
        return true;
    } else {
        console.log(`Not Exist: ${path.relative(ROOT_DIR, filePath)}`);
        return false;
    }
}

// 1. package.json 수정 및 설치
// ----------------------------------------------------------
console.log("\n[1/4] Adding @google/genai to apps/backend/package.json...");

if (!checkExists(PKG_JSON)) {
    console.error(`Error: ${PKG_JSON} not found.`);
    process.exit(1);
}

try {
    const pkgJsonContent = fs.readFileSync(PKG_JSON, 'utf8');
    const pkgJson = JSON.parse(pkgJsonContent);
    if (!pkgJson.dependencies) {
        pkgJson.dependencies = {};
    }
    pkgJson.dependencies["@google/genai"] = "^1.25.0";
    fs.writeFileSync(PKG_JSON, JSON.stringify(pkgJson, null, 2));
    console.log("package.json update successful! (@google/genai:^1.25.0)");

    console.log("Running pnpm install in apps/backend...");
    execSync('pnpm install', { cwd: BACKEND_DIR, stdio: 'inherit' });
    console.log("pnpm install successful!");
} catch (error) {
    console.error("Failed to update package.json or run pnpm install.", error);
    process.exit(1);
}


// 2. services 폴더 복사
// ----------------------------------------------------------
console.log("\n[2/4] Copying services folder...");

if (checkExists(APP_SERVICES)) {
    try {
        fs.cpSync(APP_SERVICES, BACKEND_SERVICES_DIR, { recursive: true });
        console.log(`Copy services folder successful! → ${path.relative(ROOT_DIR, BACKEND_SERVICES_DIR)}`);
    } catch (error) {
        console.error("Copy services folder failed.", error);
    }
} else {
    console.log(`Services folder not exist → ${path.relative(ROOT_DIR, APP_SERVICES)}`);
}


// 3. types.ts 파일 복사
// ----------------------------------------------------------
console.log("\n[3/4] Copying types.ts file...");

if (checkExists(APP_TYPES)) {
    try {
        const backendTypesPath = path.join(BACKEND_SERVICES_DIR, "types.ts");
        const frontendTypesPath = path.join(FRONTEND_SERVICES_DIR, "types.ts");
        fs.copyFileSync(APP_TYPES, backendTypesPath);
        fs.copyFileSync(APP_TYPES, frontendTypesPath);
        console.log("Copy types file successful! (backend, frontend)");
        checkExists(backendTypesPath);
        checkExists(frontendTypesPath);
    } catch (error) {
        console.error("Copy types file failed.", error);
    }
} else {
    console.log(`Types file not exist → ${path.relative(ROOT_DIR, APP_TYPES)}`);
}


// 4. 필수 파일 존재 확인
// ----------------------------------------------------------
console.log("\n[4/4] Checking for existence of required files...");

checkExists(path.join(BACKEND_DIR, "package.json"));
checkExists(path.join(BACKEND_DIR, "node_modules"));
checkExists(BACKEND_SERVICES_DIR);
checkExists(path.join(BACKEND_SERVICES_DIR, "geminiService.ts"));
checkExists(path.join(BACKEND_SERVICES_DIR, "types.ts"));
checkExists(path.join(FRONTEND_SERVICES_DIR, "types.ts"));

console.log("\nAll pre-steps completed!");
