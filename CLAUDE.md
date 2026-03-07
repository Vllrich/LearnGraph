# LearnGraph — AI Agent Instructions

## Project Overview
AI-powered learning platform. Monorepo with Turborepo + pnpm workspaces.

## Architecture
- **apps/web**: Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui)
- **packages/db**: Drizzle ORM + Supabase Postgres + pgvector
- **packages/ai**: Vercel AI SDK, Anthropic (Claude Sonnet 4.5), OpenAI (embeddings + fallback)
- **packages/fsrs**: FSRS-5 spaced repetition scheduler (pure algorithm, zero external deps)
- **packages/shared**: Types, constants, utilities shared across all packages

## Key Decisions
- Tailwind v4: CSS-native `@theme` in `globals.css`, NO `tailwind.config.ts`
- Fonts: Inter (UI), Source Serif 4 (AI mentor chat), JetBrains Mono (code)
- Dark mode: `next-themes` with class strategy, CSS custom properties
- Auth: Supabase Auth (email/password, Google OAuth, GitHub OAuth, magic link)
- API: tRPC v11 with Zod validation — all procedures must validate inputs
- State: TanStack Query (server) + Zustand (client)
- Background jobs: BullMQ on Railway (NOT in Vercel serverless)
- Vector search: pgvector in Supabase Postgres (migrate to Qdrant at scale)

## File Conventions
- Path alias: `@/` maps to `apps/web/src/`
- Package imports: `@repo/db`, `@repo/ai`, `@repo/fsrs`, `@repo/shared`
- Schema files: `packages/db/src/schema/*.ts` (one file per domain)
- RLS policies: raw SQL migrations via `supabase migration new` (not in Drizzle)

## Commands
- `pnpm install` — install all dependencies
- `pnpm dev` — start dev server (Turbopack)
- `pnpm build` — production build
- `pnpm lint` — lint all packages
- `pnpm format` — format all files
- `pnpm --filter web dev` — run only the web app
- `pnpm --filter @repo/db db:generate` — generate Drizzle migrations
- `pnpm --filter @repo/db db:migrate` — run migrations
- `pnpm --filter @repo/fsrs test` — run FSRS unit tests

## Design System
- Design tokens in `apps/web/src/app/globals.css` using `:root` / `.dark` CSS vars
- Mastery level colors: `mastery-0` through `mastery-5` (mapped to CSS vars)
- Animations: `animate-cursor-blink`, `animate-shimmer`, `animate-level-up`, etc.
- Component library: shadcn/ui (New York style) extended with LearnGraph patterns

## Reference Docs
- `TECHNICAL_ARCHITECTURE.md` — full system architecture, data models (§7), AI pipeline
- `DESIGN_SYSTEM.md` — colors, typography, components, layouts, animations
- `TODO.md` — implementation roadmap with dependency graph
- `AI_STARTUP_RESEARCH.md` — market research and product strategy

## Rules
- Never use `tailwind.config.ts` — Tailwind v4 uses `@theme` in CSS
- All tRPC procedures must have Zod input validation from day 1
- RLS policies go in `.sql` migration files, not in Drizzle schema
- Every async operation needs loading, error, and empty states in UI
- LLM responses must be grounded in RAG-retrieved chunks (no hallucination)
- FSRS parameters: use defaults until 50+ reviews per user
