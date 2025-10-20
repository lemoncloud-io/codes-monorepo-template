# codes-monorepo-template

pnpm monorepo with lemon-core based serverless API and React frontend

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Monorepo Root (pnpm workspace)              │
└─────────────────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┬─────────────┐
        │                        │             │
        ▼                        ▼             ▼
┌──────────────────┐    ┌──────────────────┐  ┌────────────┐
│  backend         │    │  frontend        │  │  shared    │
│  lemon-core API  │◄───┤  React SPA       │  │  packages  │
│  Port: 8000      │    │  Port: 3000      │  │            │
└──────────────────┘    └──────────────────┘  └────────────┘
```

## Project Structure

```
.
├── pnpm-workspace.yaml          # Workspace definition
├── package.json                 # Root package.json with scripts
├── tsconfig.base.json           # Base TypeScript config
├── apps/
│   ├── backend/                 # lemon-core based API (Node.js + Express/Lambda)
│   │   ├── handler.js           # Lambda handler wrapper
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── jest.config.json     # Jest test configuration
│   │   ├── env/
│   │   │   └── none.yml         # Environment variables
│   │   └── src/
│   │       ├── index.ts         # Main entry point
│   │       ├── engine.ts        # lemon-core engine initialization
│   │       ├── express.ts       # Express server setup
│   │       ├── api/
│   │       │   └── hello-api.ts # REST API controller
│   │       └── service/
│   │           ├── model.ts     # Data models
│   │           ├── service.ts   # Business logic
│   │           ├── types.ts     # Type definitions
│   │           └── views.ts     # View layer
│   ├── frontend/                # React + Vite web application
│   │   ├── vite.config.ts       # Vite config with env injection
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── index.tsx        # App entry point
│   │       └── App.tsx          # Main component with API integration
└── packages/
    └── shared/                  # Shared types and utilities
        ├── package.json
        └── src/
            ├── index.ts
            └── types/
                └── hello.ts     # Shared type definitions
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

Environment variables are managed through `apps/backend/env/none.yml`:

```yaml
# local development configuration
local:
  STAGE: 'local'
  LS: 0                   # log silence
  LC: 1                   # line-coloring
  TS: 1                   # time-stamp in line
  NAME: ''                # profile name

# development server
dev:
  STAGE: 'develop'

# production with AWS deploy
prod:
  STAGE: 'production'
  NS: SS
  TS: 0
```

### Web (apps/frontend)

Frontend calls API at `http://localhost:8000` by default (configurable via `VITE_API_URL`).

## Development

### Run both API and Web together

```bash
pnpm dev
```

This will start:

- API at <http://localhost:8000> (Express + TypeScript watch mode)
- Web at <http://localhost:3000> (Vite)

### Run API only

```bash
pnpm api:dev
```

The API will:

1. Build TypeScript files with `ttsc` (ttypescript)
2. Watch for TypeScript changes
3. Auto-reload with nodemon when files change
4. Run Express server at <http://localhost:8000>

Available endpoints:

- `GET /hello` - List all items
- `GET /hello/:id` - Get specific item
- `POST /hello/:id` - Create new item
- `PUT /hello/:id` - Update item
- `DELETE /hello/:id` - Delete item

### Run Web only

```bash
pnpm web:dev
```

Web will be available at <http://localhost:3000>

### Run Tests

```bash
# Run all tests
cd apps/backend
npm run test

# Watch mode
npm run test:watch
```

## Build

```bash
# Build all apps
pnpm build

# Build backend only
cd apps/backend && npm run build

# Build frontend only  
pnpm web:build
```

## Deployment

```bash
# Deploy API to AWS Lambda
pnpm api:deploy

# Or run standalone Express server
cd apps/backend && npm run build && node dist/src/index.js

### Preview Web build

```bash
pnpm web:preview
```

## Scripts Reference

### Root Level Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run all apps in parallel (backend + frontend) |
| `pnpm build` | Build all apps |
| `pnpm api:dev` | Run backend only (Express at :8000) |
| `pnpm api:deploy` | Deploy backend to AWS Lambda |
| `pnpm web:dev` | Run frontend only (Vite at :3000) |
| `pnpm web:build` | Build frontend for production |
| `pnpm web:preview` | Preview frontend build |


## Troubleshooting

### Port already in use

**API (port 8000):**

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
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
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

## License

Private project.
