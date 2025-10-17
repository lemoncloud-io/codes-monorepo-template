# codes-monorepo-template

Minimal pnpm monorepo with serverless API (AWS Lambda) and React frontend

## Architecture

```
┌─────────────────────────────────────────────┐
│         Monorepo Root (pnpm workspace)      │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│  backend    │    │  frontend    │
│  AWS Lambda      │◄───┤  React SPA       │
│  Port: 4000      │    │  Port: 3000      │
└──────────────────┘    └──────────────────┘
```

## Project Structure

```
.
├── pnpm-workspace.yaml          # Workspace definition
├── package.json                 # Root package.json with scripts
├── apps/
│   ├── backend/            # Serverless API (Node.js 20.x + AWS Lambda)
│   │   ├── serverless.yml       # Serverless Framework config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── src/
│   │       └── handlers/        # Lambda handler functions
│   │           └── hello.ts
│   └── frontend/            # React + Vite web application
│       ├── vite.config.ts       # Vite config with env injection
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       └── src/
│           ├── index.tsx        # App entry point
│           └── App.tsx          # Main component
└── README.md
```

## Prerequisites

- Node.js >= 22
- pnpm >= 8

Install pnpm if you haven't already:
```bash
npm install -g pnpm
```

## Installation

Install all dependencies:
```bash
pnpm install
```

## Environment Variables

### API (apps/backend)

Create a `.env` file in `apps/backend/` (copy from `.env.example`):

```env
NODE_ENV=development
AWS_REGION=ap-northeast-2
APP_NAME=backend
```

### Web (apps/frontend)

Create a `.env.local` file in `apps/frontend/` (copy from `.env.example`):

```env
VITE_API_URL=http://localhost:4000/dev
```

## Development

### Run both API and Web together

```bash
pnpm dev
```

This will start:
- API at http://localhost:4000 (Serverless Offline)
- Web at http://localhost:3000 (Vite)

### Run API only

```bash
pnpm api:dev
```

API will be available at http://localhost:4000/dev

### Run Web only

```bash
pnpm web:dev
```

Web will be available at http://localhost:3000

## Build

### Build Web application

```bash
pnpm web:build
```

Build output will be in `apps/frontend/dist/`

### Build all apps

```bash
pnpm build
```

## Deployment

### Deploy API to AWS

Make sure you have AWS credentials configured, then:

```bash
pnpm api:deploy
```

This will deploy the serverless API to AWS Lambda.

### Preview Web build

```bash
pnpm web:preview
```

## Scripts Reference

### Root Level Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run all apps in parallel |
| `pnpm build` | Build all apps |
| `pnpm api:dev` | Run API only |
| `pnpm api:deploy` | Deploy API to AWS |
| `pnpm web:dev` | Run web app only |
| `pnpm web:build` | Build web app only |
| `pnpm web:preview` | Preview web app build |


## Troubleshooting

### Port already in use

**API (port 4000):**
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

**Web (port 3000):**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Dependencies not installing

```bash
# Clear pnpm cache and reinstall
pnpm store prune
rm -rf node_modules apps/*/node_modules
pnpm install
```

## License

Private project.
