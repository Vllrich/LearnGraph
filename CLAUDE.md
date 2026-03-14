# LearnGraph — AI Agent Instructions

## What
AI-powered learning platform. Turborepo + pnpm monorepo.

| Package | Purpose |
|---------|---------|
| `apps/web` | Next.js 16 App Router, Tailwind v4, shadcn/ui |
| `packages/db` | Drizzle ORM + Supabase Postgres + pgvector |
| `packages/ai` | Vercel AI SDK, Claude Sonnet 4.5, OpenAI embeddings, ingestion pipeline |
| `packages/fsrs` | FSRS-5 spaced repetition scheduler (zero external deps) |
| `packages/shared` | Shared types, constants, utilities |

Path alias: `@/` → `apps/web/src/` | Packages: `@repo/db`, `@repo/ai`, `@repo/fsrs`, `@repo/shared`

## Why (Key Architecture Decisions)
- **Tailwind v4**: CSS-native `@theme` — no `tailwind.config.ts` will ever exist
- **tRPC v11**: all API surface; every procedure validated with Zod
- **Supabase Auth**: email/password + Google + GitHub OAuth + magic link
- **pgvector in Supabase**: vector search for RAG (migrate to Qdrant at scale)
- **Fire-and-forget ingest**: `/api/ingest` with `maxDuration: 300`; migrate to BullMQ at scale
- **FSRS defaults**: use until 50+ reviews/user

## How — Commands
```bash
pnpm install                          # install all
pnpm dev                              # web app (Turbopack)
pnpm build                            # production build
pnpm lint && pnpm format              # lint + format
pnpm --filter @repo/db db:generate    # Drizzle migrations
pnpm --filter @repo/db db:migrate     # run migrations
pnpm --filter @repo/fsrs test         # FSRS unit tests
```

## Verification — Run After Every Change
```bash
pnpm lint          # must pass
pnpm --filter web build   # catches type errors not caught by lint
```

## Implemented Routes (as of March 2026)
- `/library` — grid view, upload dialog (PDF + YouTube)
- `/library/[id]` — content detail: summary, full text, concept panel
- `/api/ingest` — triggers ingestion pipeline
- `/api/trpc/[trpc]` — tRPC (routers: health, library, review, goals, gaps, mentor, user, gamification, analytics, export)
- `/api/learn/start`, `/api/learn/session`, `/api/learn/suggest-topics` — learning session APIs
- `/api/mentor` — streaming AI mentor
- `/api/export` — content export

## Ingestion Pipeline
`upload` → `Supabase Storage` → `create learning_objects row` → `POST /api/ingest`:
1. Extract: PDF via `unpdf`, YouTube via innertube captions API
2. Chunk: headers → paragraphs → sentences, 512 max tokens, 100 overlap (`js-tiktoken`)
3. Parallel: `embedMany` (text-embedding-3-small) + 3-tier summarization (Claude) + concept extraction (Claude, dedup ≥ 0.92 cosine)
4. Set `status = ready | failed`

## Reference Docs (read before starting a task)
- `TECHNICAL_ARCHITECTURE.md` — full data models (§7), AI pipeline, system design
- `DESIGN_SYSTEM.md` — colors, typography, component patterns, animations
- `TODO.md` — implementation roadmap with dependency graph
- `.cursor/rules/` — scoped coding standards (general, frontend, backend, ai-llm)

## IMPORTANT Rules
- NEVER use `tailwind.config.ts`
- NEVER use raw LLM text completion — always `generateObject` with Zod schema
- NEVER skip ownership verification before LLM calls or data access
- NEVER add write-side-effect tools to the AI mentor without review
- YOU MUST wrap user-controlled text in XML tags to prevent prompt injection
- YOU MUST add Zod validation to every new tRPC procedure
- YOU MUST add loading + error + empty states to every async UI component
- RLS policies go in `.sql` migration files — never in Drizzle schema
- Install new dependencies only after checking docs via `context7` MCP
