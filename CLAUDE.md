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
- **Learner Profile**: dedicated `learner_profiles` table (not JSONB) — declared + inferred dimensions drive mentor persona, curriculum method-defaults, and question difficulty

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
- `/settings` — study preferences, learner profile, notifications, quiet hours
- `/course/[goalId]` — modular course roadmap (V2)
- `/course/[goalId]/learn` — block-by-block lesson player (V2)
- `/api/ingest` — triggers ingestion pipeline
- `/api/trpc/[trpc]` — tRPC (routers: health, library, review, goals, gaps, mentor, user, gamification, analytics, export)
- `/api/learn/start`, `/api/learn/session`, `/api/learn/suggest-topics` — V1 learning session APIs
- `/api/learn/start-v2` — modular course generation
- `/api/learn/session-v2` — block-driven learning session (SSE)
- `/api/mentor` — streaming AI mentor (persona-adapted)
- `/api/export` — content export

## Learner Profile System
Adaptive profile that changes how the entire app behaves per user. Stored in `learner_profiles` (dedicated table, not JSONB).

**Declared dimensions** (user sets in `/settings`):
- `educationStage` — vocabulary level, analogy sources, session defaults
- `nativeLanguage` / `contentLanguage` — bilingual term intros; teach in non-English
- `communicationStyle` — casual | balanced | formal
- `explanationDepth` — concise | standard | thorough
- `mentorTone` — encouraging | neutral | challenging
- `expertiseDomains` — cross-domain analogies, prerequisite skipping
- `learningMotivations` — career | curiosity | exam | hobby | academic
- `accessibilityNeeds` — dyslexia, ADHD, visual impairment, reduced motion

**Inferred dimensions** (calibrated from review sessions, used when `calibrationConfidence > 0.3`):
- `inferredPace` — slow | medium | fast
- `inferredReadingLevel` — Flesch-Kincaid grade
- `inferredBloomCeiling` — caps question complexity
- `inferredOptimalSessionMin` — observed focus sweet-spot

**Where the profile is applied:**
- `packages/ai/src/mentor/persona.ts` → `buildPersonaBlock(profile)` injected into mentor system prompt
- `packages/ai/src/curriculum/method-defaults.ts` → `getProfilePrompt(profile)` in curriculum generation
- `apps/web/src/server/trpc/routers/user.ts` → `getLearnerProfile`, `updateLearnerProfile` procedures
- Migration: `packages/db/drizzle/0004_brown_johnny_blaze.sql`

## Ingestion Pipeline
`upload` → `Supabase Storage` → `create learning_objects row` → `POST /api/ingest`:
1. Extract: PDF via `unpdf`, YouTube via innertube captions API
2. Chunk: headers → paragraphs → sentences, 512 max tokens, 100 overlap (`js-tiktoken`)
3. Parallel: `embedMany` (text-embedding-3-small) + 3-tier summarization (Claude) + concept extraction (Claude, dedup ≥ 0.92 cosine)
4. Set `status = ready | failed`

## Modular Course System (V2)
Hierarchical Course → Module → Lesson → Block structure replacing flat curriculum_items.
- **6 learning modes**: understand_first, remember_longer, apply_faster, deep_mastery, exam_prep, mentor_heavy
- **7 block types**: concept, worked_example, checkpoint, practice, reflection, scenario, mentor
- **Adaptive path engine**: mastery gates, module unlocking, skip eligibility, remedial insertion
- **Schema**: `course_modules`, `course_lessons`, `lesson_blocks` tables + `learning_mode`/`schema_version` on `learning_goals`
- Full docs: `docs/modular-courses.md`

## Reference Docs (read before starting a task)
- `TECHNICAL_ARCHITECTURE.md` — full data models (§7), AI pipeline, system design
- `docs/modular-courses.md` — V2 modular course system architecture
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
