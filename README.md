# Template Monorepo

Simple monorepo structure using pnpm workspaces.

## Project Structure

```
.
├── pnpm-workspace.yaml          # Workspace definition
├── package.json                 # Root package.json with scripts
├── apps/
│   ├── template-api/             # Serverless API (Node.js + AWS Lambda)
│   │   ├── serverless.yml
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── handlers/       # Lambda handlers
│   │       └── services/       # Business logic
│   └── template-web/             # React + Vite web application
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── .env.example
│       └── [source code]
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

### API (apps/template-api)

Create a `.env` file in `apps/template-api/` (copy from `.env.example`):

```env
NODE_ENV=development
AWS_REGION=ap-northeast-2
GEMINI_API_KEY=your_api_key_here
```

### Web (apps/template-web)

Create a `.env.local` file in `apps/template-web/` (copy from `.env.example`):

```env
VITE_API_URL=http://localhost:3000/dev
```

## Development

### Run both API and Web together

```bash
pnpm dev
```

This will start:
- API at http://localhost:3000 (Serverless Offline)
- Web at http://localhost:5173 (Vite)

### Run API only

```bash
pnpm api:dev
```

API will be available at http://localhost:3000/dev

### Run Web only

```bash
pnpm web:dev
```

Web will be available at http://localhost:5173

## Build

### Build Web application

```bash
pnpm web:build
```

Build output will be in `apps/sample-web/dist/`

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

**API (port 3000):**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Web (port 5173):**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
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
