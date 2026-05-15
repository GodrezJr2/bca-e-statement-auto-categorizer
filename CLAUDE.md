# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

- `backend/` is a FastAPI app for BCA e-statement ingestion, parsing, categorization, export, insights, budgets, and flow-map APIs.
- `frontend/` is a Next.js app using App Router, TypeScript, Tailwind CSS v4, Supabase SSR/browser clients, Recharts, and D3 Sankey.
- `supabase/schema.sql` defines core `categories` and `transactions` tables plus RLS policies. `backend/migrations/004_budgets.sql` adds per-user budgets.
- `backend/.venv/` and `frontend/node_modules/` are local dependency directories; do not inspect or edit them unless troubleshooting dependency internals.

## Common commands

Backend commands run from `backend/`:

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
python -m pytest -v
python -m pytest tests/test_flows.py -v
python -m pytest tests/test_flows.py::test_get_flows_returns_nodes_and_links -v
```

Backend Docker image:

```bash
docker build -t bca-estatement-api backend
docker run --env-file backend/.env -p 8000:8000 bca-estatement-api
```

Frontend commands run from `frontend/`:

```bash
npm install
npm run dev
npm run build
npm run start
npx tsc --noEmit
```

No frontend test or lint script is configured in `frontend/package.json`.

## Environment

Backend reads `backend/.env` via `python-dotenv`. Required runtime variables include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY` for LLM fallback categorization in `services/categorizer.py`
- `CORS_ORIGINS` optional; defaults to `*` in `backend/main.py`

`backend/.env.example` still lists older `LLM_PROVIDER`, `GEMINI_API_KEY`, and `OPENAI_API_KEY` names, but current categorizer code uses OpenRouter.

Frontend uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` pointing to the FastAPI backend, e.g. `http://localhost:8000`

## Backend architecture

`backend/main.py` creates the FastAPI app, configures CORS, and mounts routers under `/api`:

- `routers/statements.py`: `POST /api/upload-statement`, `GET /api/transactions/export`, `PATCH /api/transactions/{transaction_id}`.
- `routers/insights.py`: `GET /api/insights` for month-over-month spending insight strings.
- `routers/budgets.py`: `GET /api/budgets`, `PUT /api/budgets/{category}`.
- `routers/flows.py`: `GET /api/flows` for Sankey-ready category flow data.

Routes authenticate with Supabase JWT from `Authorization: Bearer <token>`, then use service-role Supabase client server-side. Tests mock each router's `_get_supabase()` so they run without real credentials.

Statement upload flow:

1. Validate JWT, rate limit uploads in memory, read PDF bytes without writing to disk.
2. Validate MIME type, `%PDF-` magic bytes, and 10 MB size limit.
3. `services/pdf_parser.py` decrypts optional password-protected BCA PDF using `pikepdf`, extracts rows with `pdfplumber`, and returns signed amounts where debits are negative.
4. `services/categorizer.py` applies keyword rules first, then falls back to OpenRouter chat completions for unknown descriptions.
5. Existing transactions for uploaded months are deleted for that user, then fresh categorized rows are inserted.

Flow map data is split between `routers/flows.py` for auth/date validation/Supabase query and `services/flow_aggregator.py` for pure aggregation. Credits are ignored; debit totals become `Income -> <category>` links.

Pydantic response/request models live in `models/schemas.py`; keep API shape changes mirrored in frontend `lib/types.ts` or `lib/api/*` types.

## Frontend architecture

Next.js App Router pages in `frontend/app/` are mostly server components that authenticate via `createServerSupabaseClient()` and redirect unauthenticated users to `/login`. Interactive dashboards are client components:

- `app/dashboard/DashboardClient.tsx` renders overview, upload form, charts, largest transactions, and budget tracker.
- `app/dashboard/statements/StatementsClient.tsx` handles month/global search, category edits, and CSV export.
- `app/dashboard/analytics/AnalyticsClient.tsx` renders trends and fetches backend insights.
- `app/dashboard/map/FlowMapClient.tsx` fetches backend flow data and renders Sankey/drilldown components.

Supabase clients:

- `lib/supabase-server.ts` wraps `@supabase/ssr` server client with Next cookies.
- `lib/supabase.ts` creates browser client for auth/session and direct client-side Supabase reads.

Backend API calls from frontend use `NEXT_PUBLIC_API_URL` and pass Supabase access token in `Authorization` header. Direct Supabase reads rely on RLS policies in `supabase/schema.sql`.

UI style is centralized in `app/globals.css` CSS variables and Tailwind utilities. Shared primitives are in `components/ui/`; app-specific visualization and dashboard widgets live in `components/`.

## Next.js version warning

`frontend/AGENTS.md` says this Next.js version has breaking changes and future agents should read relevant guides in `node_modules/next/dist/docs/` before writing Next.js code. Follow that when touching framework APIs, routing, server components, or config.

## Existing guidance note

`frontend/CLAUDE.md` exists but currently mixes project notes with session-specific instructions. Prefer this root file as repository guidance; if updating frontend guidance, keep only durable frontend-specific rules there.
