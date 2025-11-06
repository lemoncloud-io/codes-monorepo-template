# codes-monorepo-template

monorepo with `lemon-core` based serverless API and React frontend

## Architecture

```txt
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

## Prerequisites

- Node.js >= 22

## Environment Variables

### Web (apps/frontend)

Frontend calls API at `http://localhost:8000` by default (configurable via `VITE_API_URL`).

## Development

### Run API only

```bash
npm run backend
```

### Run Web only

```bash
npm run frontend
```

Web will be available at <http://localhost:3000>

### Run Refactor

```bash
# pre-peration
./refactor-prepare.sh <app-in-sample-folder>
# refactoring backend w/ gemini
./refactor-backend.sh
# refactoring frontend w/ gemini
./refactor-frontend.sh
```

## License

ISC
