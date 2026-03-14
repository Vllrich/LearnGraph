# LearnGraph — Implementation TODO & Roadmap

> **Status:** Phase 1E — Feature Complete (all core features in place, tests & observability remain)  
> **Last Updated:** March 8, 2026  
> **Reference Docs:** [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) · [Design System](./DESIGN_SYSTEM.md) · [Market Research](./AI_STARTUP_RESEARCH.md) · [Feature Status](./feature-status.md)

---

## How to Use This Document

Each task has a **status**, **priority**, **dependency**, and **acceptance criteria**. Tasks are grouped by implementation phase and ordered by dependency chain. Never start a task whose dependencies aren't complete.

**Status legend:** `[ ]` TODO · `[~]` In Progress · `[x]` Done · `[!]` Blocked

---

## Phase 0 — Project Scaffolding & Infrastructure (Week 1)

> **Goal:** Zero-to-running dev environment. Every engineer can clone, install, and see a working app in under 5 minutes.

### 0.1 Repository & Tooling

- [x] **P0** Initialize git repo, `.gitignore` (Node, Next.js, env files, `.DS_Store`, IDE configs)
- [x] **P0** Initialize monorepo structure with Turborepo
  ```
  /
  ├── apps/
  │   └── web/          # Next.js app
  ├── packages/
  │   ├── db/           # Drizzle schema, migrations, client
  │   ├── ai/           # LLM orchestration, prompts, RAG
  │   ├── fsrs/         # FSRS scheduling engine
  │   └── shared/       # Types, constants, utils
  ├── turbo.json
  ├── package.json
  └── .env.example
  ```
- [x] **P0** Create `apps/web` — scaffold Next.js 16 (App Router, TypeScript, `src/` directory)
- [x] **P0** Install and configure Tailwind CSS v4 (CSS-native `@theme` config — no `tailwind.config.ts`)
- [x] **P0** Install and initialize shadcn/ui (New York style, HSL CSS variables)
- [x] **P0** Install Vercel AI SDK + provider packages: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`
- [x] **P0** Configure path aliases (`@/`, `@repo/db`, `@repo/ai`, `@repo/fsrs`, `@repo/shared`)
- [x] **P0** Create `.env.example` with all required env vars (Supabase URL/key, OpenAI key, Anthropic key, Upstash Redis URL, Langfuse keys)
- [x] **P0** Configure ESLint (strict TypeScript rules) + Prettier
- [x] **P1** Configure Husky + lint-staged (pre-commit: lint + format)
- [x] **P1** Add `docker-compose.yml` for local Redis (BullMQ development)
- [ ] **P1** Create Railway project for BullMQ workers (Vercel cannot host persistent processes — workers must run on Railway from day 1)

**Acceptance:** `pnpm install && pnpm dev` starts the app at `localhost:3000` with a blank page. All packages build cleanly.

### 0.2 Supabase Setup

- [x] **P0** Create Supabase project (select region closest to target users) — eu-west-2, project `wezahaxklgudeehrlvxw`
- [x] **P0** Enable pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`) — v0.8.0 installed
- [x] **P0** Configure Supabase Auth — enable Email/Password + Google OAuth + GitHub OAuth + Magic Link
- [x] **P0** Create storage bucket `content-uploads` (private, 50 MB file size limit, allowed MIME types: PDF, PPTX, DOCX, MP3, MP4, WAV, PNG, JPG, WEBP)
- [x] **P0** Set up Supabase CLI for local development (`supabase init`, `supabase start`) — config.toml created
- [ ] **P1** Configure storage lifecycle policy (delete orphaned files after 30 days)

**Acceptance:** Supabase dashboard accessible. Auth login flow works. File upload to storage bucket succeeds. pgvector extension confirmed via `SELECT * FROM pg_extension WHERE extname = 'vector'`.

### 0.3 Database Schema v1

> **Ref:** Technical Architecture §7 (Data Models)

- [x] **P0** Set up Drizzle ORM in `packages/db` with Supabase Postgres connection
- [x] **P0** Create migration: `users` table (§7.1) — includes `timezone TEXT DEFAULT 'UTC'` (IANA timezone, detected from browser during onboarding)
- [x] **P0** Create migration: `learning_objects` + `content_chunks` tables (§7.2)
- [x] **P0** Create migration: `concepts` + `concept_edges` + `concept_chunk_links` tables (§7.3) — note: `concepts.embedding` is `vector(1536)` (not `TEXT`), needed for deduplication similarity matching
- [x] **P0** Create migration: `user_concept_state` + `review_log` tables (§7.4)
- [x] **P0** Create migration: `questions` + `user_answers` tables (§7.5)
- [x] **P0** Create migration: `mentor_conversations` table (§7.6) — `user_id`, `learning_object_id`, `title`, `messages JSONB`, `teaching_objective`
- [x] **P1** Create migration: `learning_goals` + `curriculum_items` tables (§7.7)
- [x] **P0** Add all indexes as specified in the architecture doc
- [x] **P0** Enable Row-Level Security on ALL tables — use Supabase CLI raw SQL migrations for RLS policies (Drizzle doesn't natively support RLS; keep schema in Drizzle, policies in `.sql` migration files via `supabase migration new`)
- [x] **P0** RLS policies: users can only CRUD their own data (`auth.uid() = user_id`). Concepts table is read-accessible to all authenticated users.
- [x] **P0** Seed script: create test user + sample learning object + sample concepts for dev

**Acceptance:** `pnpm db:migrate` runs cleanly. `pnpm db:seed` populates test data. RLS verified: user A cannot read user B's learning objects via Supabase client.

### 0.4 tRPC Setup

- [x] **P0** Install tRPC v11 + `@trpc/server` + `@trpc/client` + `@trpc/react-query` + `@tanstack/react-query`
- [x] **P0** Install Zod — all tRPC procedure inputs must have Zod schemas from day 1 (not deferred to polish)
- [x] **P0** Configure tRPC router in `apps/web/src/server/trpc/` with context (DB client, userId placeholder for Supabase Auth)
- [x] **P0** Create base procedures: `publicProcedure`, `protectedProcedure` (requires auth)
- [x] **P0** Wire tRPC to Next.js API route handler (`/api/trpc/[trpc]`) via fetch adapter
- [x] **P0** Set up tRPC client provider in root layout with TanStack Query + server-side hydration helpers
- [x] **P0** Smoke test: create a `health.check` procedure returning status + timestamp

**Acceptance:** Browser console shows successful tRPC health check response. TypeScript autocomplete works end-to-end (procedure inputs/outputs). All procedures validate inputs via Zod.

### 0.5 Design System Foundation

> **Ref:** Design System §3–§5, §13

- [x] **P0** Implement `:root` / `.dark` CSS custom properties in `globals.css` — full light/dark mode palette (§3.1)
- [x] **P0** Add mastery-level CSS variables in `:root` / `.dark` (§3.2)
- [x] **P0** Define `@theme` block with all design tokens — colors, fonts, spacing, shadows, animations, border-radius (§4.3, §13). Tailwind v4 uses CSS-native `@theme` — no `tailwind.config.ts` needed.
- [x] **P0** Set up font loading — Inter (variable), Source Serif 4 (variable), JetBrains Mono — via `next/font` with preload
- [x] **P0** Install and configure `next-themes` for dark mode toggle (system default, user override) — ThemeProvider wired in root layout with class strategy, system default, transition disabled
- [x] **P0** Create `reduced-motion` media query styles (§8)
- [x] **P1** Add gradient utility classes (§3.3)
- [x] **P1** Add keyframe animations: `cursor-blink`, `pulse-ring`, `level-up`, `card-flip`, `flame`, `shimmer` (§8)

**Acceptance:** Light/dark mode toggle works. All design tokens render correctly. Font loading produces no layout shift (check with Lighthouse).

### 0.6 CI/CD Pipeline

- [x] **P1** GitHub Actions workflow: `ci.yml` — on PR: lint → typecheck → build → test
- [ ] **P1** Vercel project connected to repo — auto-deploy `main` branch
- [ ] **P1** Environment variables configured in Vercel dashboard (Supabase, API keys)
- [ ] **P2** Branch preview deployments enabled on Vercel

**Acceptance:** Push to `main` triggers successful Vercel deployment. PR opens trigger CI checks.

---

## Phase 1A — Auth & Core Layout (Week 2)

> **Goal:** Users can sign up, log in, and navigate the authenticated shell.

### 1.1 Authentication Flow

- [x] **P0** Create auth utility in `lib/supabase/` — server client (cookies) + browser client
- [x] **P0** Auth middleware (`middleware.ts`) — redirect unauthenticated users to `/login`, redirect authenticated users away from `/login`
- [x] **P0** `/login` page — email + password form, Google OAuth button, GitHub OAuth button, magic link option
- [x] **P0** `/signup` page — email + password + display name, OAuth options
- [x] **P0** `/auth/callback` route — handle OAuth redirect, set session cookies
- [x] **P0** Logout functionality — clear session, redirect to `/login`
- [x] **P1** Onboarding flow after first signup — collect: display name, learning goal (free text), daily review budget (slider: 5–50 cards)
- [x] **P1** Store onboarding data in `users.onboarding` and `users.preferences` JSONB fields

**Acceptance:** Full signup → login → authenticated dashboard → logout cycle works. OAuth with Google works. Session persists on refresh. Unauthenticated routes redirect correctly.

**Deps:** 0.2, 0.3, 0.4

### 1.2 Application Shell & Navigation

> **Ref:** Design System §9.1, §12

- [x] **P0** App layout (`(app)/layout.tsx`) — sidebar + main content area
- [x] **P0** `Sidebar` component — navigation links: Home, Library, Mentor, Review, Goals, Stats, Graph
  - Desktop: full 256px sidebar (§5.2)
  - Tablet: collapsed icon rail, expand on hover
  - Mobile: bottom tab bar (5 primary items)
- [x] **P0** `PageContainer` component — max-w-7xl, responsive padding (§5.2)
- [x] **P0** `MobileTabBar` component — Home, Library, Review, Mentor, More
- [x] **P0** User avatar + dropdown in sidebar footer (settings, logout)
- [x] **P1** Active route highlighting in sidebar
- [x] **P1** Breadcrumb component for nested pages

**Acceptance:** Responsive layout correct at all breakpoints (mobile/tablet/desktop). Navigation between all stub pages works. Active state highlights correct route.

**Deps:** 0.5, 1.1

### 1.3 Dashboard Page (Home)

> **Ref:** Design System §9.1

- [x] **P0** Dashboard layout: greeting + streak counter + daily review card + knowledge snapshot + recent content list
- [x] **P0** `DailyReviewCard` — shows count of due concepts, estimated time, "Start Review" CTA (static data for now)
- [x] **P0** `RecentContentList` — list of user's learning objects with status badges (empty state if none)
- [x] **P1** `KnowledgeSnapshot` — mini graph preview placeholder (static SVG for now)
- [x] **P1** `StreakCounter` — flame icon + day count (static for now)
- [x] **P1** Empty state design for new users — "Upload your first document to get started"

**Acceptance:** Dashboard renders with placeholder/mock data. Empty state shows for new users. Layout matches the wireframe in Design System §9.1.

**Deps:** 1.2

---

## Phase 1B — Content Ingestion Pipeline (Weeks 3–4)

> **Goal:** Users can upload PDFs and YouTube links. Content is parsed, chunked, embedded, summarized, and concepts are extracted.

### 2.1 File Upload UI

- [x] **P0** `/library` page — grid/list view of user's learning objects
- [x] **P0** Upload modal/dialog — drag-and-drop zone + file picker + YouTube URL input
- [x] **P0** Supported types for MVP: PDF, YouTube URL
- [x] **P0** File validation — type check, size limit (50 MB), display error for invalid files
- [x] **P0** Upload file to Supabase Storage (`content-uploads/{user_id}/{file_id}`)
- [x] **P0** Create `learning_objects` row with `status: 'processing'`
- [x] **P0** Show processing status indicator (shimmer loading card) in library
- [ ] **P1** Bulk upload (multiple files at once)

**Acceptance:** PDF upload stores file in Supabase Storage, creates DB record with `status: 'processing'`. YouTube URL accepted and stored. Upload progress indicator shown. Invalid files rejected with clear error.

**Deps:** 0.2, 0.3, 1.2

### 2.2 Background Job Queue

- [x] **P0** Set up ingestion pipeline in `packages/ai/src/ingestion/` — co-located with Next.js API route (upgradeable to BullMQ/Railway)
- [x] **P0** Pipeline orchestrator: extract → chunk → embed + summarize + extract concepts in parallel
- [x] **P0** Create job types: `process-pdf`, `process-youtube`, `generate-embeddings`, `extract-concepts`, `generate-summary`
- [x] **P0** Job worker entry point — runs co-located via `/api/ingest` route (fire-and-forget with `maxDuration: 300`)
- [x] **P0** Error handling: pipeline catches errors and marks `learning_objects.status` as `'failed'` with error message
- [x] **P0** On job completion: update `learning_objects.status` to `'ready'` or `'failed'`
- [x] **P1** Frontend polling: library page refetches every 10s, content detail refetches every 5s while processing

**Acceptance:** Enqueuing a job writes to Redis. Worker picks up and processes the job. On completion, learning object status updates. Frontend receives real-time status update without page refresh.

**Deps:** 0.1 (Docker Redis), 0.2

### 2.3 PDF Processing

- [x] **P0** Install `unpdf` for PDF text extraction
- [x] **P0** PDF → raw text extraction with page number tracking (`extractText` with `mergePages: false`)
- [x] **P0** Text normalization: fix encoding, normalize whitespace, collapse extra newlines
- [x] **P0** Metadata extraction: page count, title (from PDF metadata or first heading)
- [x] **P0** Store `raw_text` in `learning_objects`
- [x] **P1** Handle scanned PDFs gracefully — detect if text extraction yields < 100 chars, pipeline throws error

**Acceptance:** Upload a 20-page PDF. Raw text extracted with correct page numbers. Metadata populated. Text is clean and readable.

**Deps:** 2.2

### 2.4 YouTube Processing

- [x] **P0** Accept YouTube URL, extract video ID (regex for all URL formats)
- [x] **P0** Fetch transcript via YouTube innertube API (no API key needed for auto-generated captions)
- [x] **P0** Fallback: if no captions available, use OpenAI Whisper API on the audio track
- [x] **P0** Fetch video metadata: title, duration, thumbnail URL, channel name
- [x] **P0** Store transcript as `raw_text` in `learning_objects`
- [ ] **P1** Timestamp-aware chunking — preserve timestamp markers for citation linking

**Acceptance:** YouTube URL with captions: transcript extracted within 30 seconds. Video without captions: Whisper transcription completes (may take longer). Metadata populated correctly.

**Deps:** 2.2

### 2.5 Semantic Chunking

> **Ref:** Technical Architecture §5.1

- [x] **P0** Implement semantic chunking strategy (NOT fixed-size):
  1. Split on section headers / double newlines first
  2. If chunk > 512 tokens, recursively split on paragraph boundaries
  3. If still too large, split on sentence boundaries
  4. Apply ~100-token overlap between adjacent chunks
- [x] **P0** Assign metadata per chunk: `section_title`, `page_number`, `chunk_index`, `token_count`
- [x] **P0** Store chunks in `content_chunks` table
- [x] **P0** Token counting: use `js-tiktoken` for accurate OpenAI-compatible token counts
- [ ] **P1** Use LangChain.js `RecursiveCharacterTextSplitter` as fallback for unstructured text

**Acceptance:** A 20-page PDF produces 30–80 chunks. No chunk exceeds 512 tokens. Adjacent chunks have ~100-token overlap. Section titles preserved where detectable.

**Deps:** 2.3, 2.4

### 2.6 Embedding Generation

- [x] **P0** OpenAI `text-embedding-3-small` integration (1536 dimensions) via Vercel AI SDK `embedMany`
- [x] **P0** Batch embed all chunks for a learning object (batches of 100 for API limits)
- [x] **P0** Store embeddings in `content_chunks.embedding` (pgvector column)
- [x] **P0** Create HNSW index on `content_chunks.embedding` for fast similarity search (in Supabase migration)
- [x] **P0** Rate limiting / error handling for OpenAI API calls
- [ ] **P1** Track embedding costs via Langfuse

**Acceptance:** All chunks for a learning object have embeddings stored. Vector similarity search returns relevant chunks for a test query. Embedding generation for a 20-page PDF completes in < 60 seconds.

**Deps:** 2.5, 0.2 (pgvector)

### 2.7 AI Summarization

> **Ref:** Technical Architecture §5.2

- [x] **P0** Three-tier summarization with Claude Sonnet 4.5:
  - TL;DR (2–3 sentences)
  - Key Points (5–10 bullets)
  - Deep Summary (500–1000 words)
- [x] **P0** Structured output (JSON) via Vercel AI SDK `generateObject` with Zod schema
- [x] **P0** For documents > context window: hierarchical summarization (per-section → meta-summary)
- [x] **P0** Store summaries in `learning_objects` (summary_tldr, summary_key_points, summary_deep)
- [x] **P0** Cache: never regenerate unless source content changes
- [ ] **P1** Langfuse tracing on every LLM call (latency, tokens, cost)

**Acceptance:** Upload a PDF → three summary tiers generated and stored. Summaries are factually grounded in the source content. Long document (50+ pages) handled via hierarchical approach without hitting context limits.

**Deps:** 2.5

### 2.8 Concept Extraction (runs during ingestion)

> **Ref:** Technical Architecture §5.4
>
> This is part of the ingestion pipeline — runs as a background job after chunking, parallel with summarization and embedding. Placed here (not in Phase 1C) because the mentor, quiz generation, and knowledge graph all depend on extracted concepts.

- [x] **P0** LLM-based concept extraction from content chunks (Claude Sonnet 4.5, structured JSON output via Zod schema)
- [x] **P0** Deduplicate concepts: canonical name matching + embedding similarity (threshold: 0.92) to merge synonyms
- [x] **P0** Create/update `concepts` table rows + `concept_edges` (prerequisite, related_to)
- [x] **P0** Link concepts to source chunks via `concept_chunk_links`
- [x] **P0** Wire into ingestion pipeline: after chunking completes, fan out to `generate-embeddings` + `extract-concepts` + `generate-summary` in parallel
- [ ] **P1** Confidence scoring on extracted concepts — low-confidence concepts flagged for user review

**Acceptance:** A 20-page ML textbook PDF produces 15–40 concepts with dependency edges. "Machine Learning" and "ML" are merged into a single node. Each concept links back to its source chunks.

**Deps:** 2.5, 2.6

### 2.9 Content Detail UI

> **Ref:** Design System §9.2

- [x] **P0** `/library/[id]` page — content detail view
- [x] **P0** Tab layout: Summary | Full Text
- [x] **P0** Summary tab: TL;DR → Key Points → Deep Summary (card sections)
- [x] **P0** Full Text tab: rendered chunks with section headings in scroll area
- [x] **P0** Side panel: extracted concepts list with difficulty badges, action buttons (Ask Mentor, Quiz Me)
- [ ] **P1** PDF viewer embed (optional: render original PDF alongside summary)
- [x] **P1** YouTube embed for video content

**Acceptance:** Content detail page shows all three summary tiers. Tabs switch correctly. Side panel shows extracted concepts. Responsive layout matches Design System §9.2 wireframe.

**Deps:** 2.7, 2.8, 1.2

---

## Phase 1C — AI Mentor Chat (Weeks 5–6)

> **Goal:** RAG-powered AI mentor that teaches from uploaded content using Socratic method.

### 3.1 RAG Retrieval Pipeline

- [x] **P0** Implement hybrid search: vector similarity (pgvector) + BM25 keyword matching (Postgres full-text search)
- [x] **P0** Retrieval function: `retrieveChunks(query, userId, learningObjectId?, topK=5)`
- [x] **P0** Metadata filtering: optionally scope retrieval to a specific learning object or section
- [x] **P0** Relevance scoring: combine vector score + BM25 score (weighted: 0.7 vector + 0.3 BM25)
- [x] **P0** Return chunks with source metadata (doc title, section, page number) for citation
- [ ] **P1** Re-ranking with cross-encoder (Phase 2 optimization — stub the interface now)

**Acceptance:** Query "What is gradient descent?" against an ML textbook returns the 5 most relevant chunks, all from sections discussing optimization. Hybrid search outperforms pure vector search on a manual test set of 10 queries.

**Deps:** 2.6

### 3.2 AI Mentor Backend

> **Ref:** Technical Architecture §5.5

- [x] **P0** Mentor system prompt encoding the pedagogical loop: ASSESS → TEACH → PRACTICE → VERIFY → CONNECT
- [x] **P0** Conversation context assembly:
  1. User's knowledge state for relevant concepts (from `user_concept_state`)
  2. Retrieved content chunks (RAG, top 5)
  3. Conversation history (last 10 turns)
  4. Current teaching objective
- [x] **P0** Tool calling via Vercel AI SDK — tools available to mentor:
  - `check_knowledge_state(concept_name)` → returns mastery level
  - `retrieve_content(query)` → returns relevant chunks
  - `generate_quiz(concept_name, difficulty)` → inline quiz question
  - `update_mastery(concept_name, score)` → update user state
- [x] **P0** Streaming response via Vercel AI SDK (`streamText`)
- [x] **P0** Grounding enforcement: if retrieval similarity < threshold, mentor responds with "I don't have enough information about this in your materials."
- [x] **P0** Store conversation history in `mentor_conversations` table (§7.6)
- [ ] **P1** Langfuse tracing for every mentor call

**Acceptance:** Mentor can answer questions grounded in uploaded content. Responses cite source material. Streaming works (tokens appear progressively). Tool calls execute correctly (e.g., generating an inline quiz). Off-topic questions get appropriate "I don't have info" response.

**Deps:** 3.1, 0.4

### 3.3 Mentor Chat UI

> **Ref:** Design System §6.4

- [x] **P0** `/mentor` page OR slide-out panel accessible from content detail
- [x] **P0** Chat message list — user messages right-aligned (`bg-brand-primary/10`), AI messages left-aligned (`bg-muted`, serif font `Source Serif 4`)
- [x] **P0** Streaming display — tokens render as they arrive, blinking cursor animation
- [x] **P0** Source citations — clickable chip below AI message linking to source chunk (doc title, page number)
- [x] **P0** Chat input — text input + send button, disabled while AI is responding
- [x] **P0** Context selector — which learning object(s) the mentor should reference
- [ ] **P1** Inline quiz rendering — when mentor generates a quiz via tool call, render interactive MCQ/short-answer in the chat
- [x] **P1** Conversation history — sidebar list of past conversations, ability to resume
- [x] **P1** "Explain like I'm 5" / "Go deeper" quick-action buttons

**Acceptance:** Full chat loop works: type question → see streaming AI response → see source citation → click citation to see chunk. Mentor uses Socratic questioning. UI matches Design System §6.4 wireframe.

**Deps:** 3.2, 1.2

---

## Phase 1D — Quiz, Flashcards & Spaced Repetition (Weeks 5–6)

> **Goal:** Auto-generate quizzes and flashcards. FSRS-based scheduling. Daily review queue.
>
> **Note:** FSRS engine (4.2) has zero dependencies and can start Week 1. Quiz generation (4.1) depends on concept extraction (2.8) from Phase 1B. The review UI (4.5) depends on the full chain.

### 4.1 Quiz Generation

> **Ref:** Technical Architecture §5.3

- [x] **P0** Quiz generation pipeline:
  1. Select target concept(s) for the quiz
  2. Retrieve relevant chunks
  3. LLM generates questions (structured JSON output):
     ```json
     {
       "question": "...",
       "type": "mcq | short_answer | fill_blank | explain_back",
       "options": [...],
       "correct_answer": "...",
       "explanation": "...",
       "concept_ids": [...],
       "difficulty": 1-5,
       "grounding_chunks": [...]
     }
     ```
  4. Validate: discard questions where correct answer can't be grounded in source chunks
- [x] **P0** Store in `questions` table linked to learning object and concepts
- [x] **P0** Pre-generate quiz bank during ingestion (batch job) — 5–10 questions per concept
- [x] **P0** Quality scoring: track user feedback (thumbs up/down), exclude low-rated questions
- [x] **P1** Difficulty adaptation: >80% correct → increase difficulty, <60% → decrease + flag gap

**Acceptance:** Upload a document → quiz bank auto-generated for each extracted concept. MCQ questions have 4 options with exactly 1 correct. Every question links to grounding chunks. Questions are factually accurate (manual review of 10 questions).

**Deps:** 2.8, 3.1

### 4.2 FSRS Engine

> **Ref:** Technical Architecture §6.5

- [x] **P0** Implement FSRS-5 algorithm in `packages/fsrs/` (~200 lines of core logic)
  - Reference: `ts-fsrs` npm package (or port from open-source FSRS reference implementation)
- [x] **P0** Core functions:
  - `schedule(card, rating)` → returns updated card state + next review date
  - `getRetrievability(card)` → current recall probability (0–1)
- [x] **P0** Rating scale: 1=Again, 2=Hard, 3=Good, 4=Easy
- [x] **P0** Card state machine: New → Learning → Review → Relearning
- [x] **P0** Default parameters (FSRS-5 pretrained). Personalization after 50+ reviews (Phase 2).
- [x] **P0** Unit tests: 25 Vitest tests covering new card scheduling, state transitions, difficulty clamping, stability floor, max interval, retrievability decay, multi-review lifecycle

**Acceptance:** FSRS scheduler produces correct intervals for all rating combinations. `getRetrievability` decays over time. Card state transitions are correct. 100% unit test pass rate.

**Deps:** None (pure algorithm, no external deps — can start as early as Week 1)

### 4.3 User Concept State & Mastery Tracking

> **Ref:** Technical Architecture §5.6

- [x] **P0** `user_concept_state` CRUD via tRPC:
  - `getState(userId, conceptId)` — returns mastery + FSRS state
  - `updateState(userId, conceptId, rating)` — runs FSRS schedule, updates mastery level
  - `getDueReviews(userId)` — all concepts where `retrievability < 0.9`
- [x] **P0** Mastery level update rules (§5.6):
  - Read summary → `exposed` (1)
  - Quiz correct → increment mastery, extend FSRS interval
  - Quiz incorrect → decrement mastery, shorten interval, flag gap
  - Explain-back success → highest boost
  - Time passes → FSRS decay reduces retrievability
- [x] **P0** Write to `review_log` on every review event (for analytics and FSRS personalization)
- [x] **P0** Initialize `user_concept_state` rows when user first encounters a concept (e.g., views content containing it)

**Acceptance:** User answers quiz correctly → mastery increments, next review date moves forward. Answers incorrectly → mastery decrements, review scheduled sooner. After 3 days of no review, retrievability has decayed.

**Deps:** 4.2, 2.8

### 4.4 Daily Review Queue

> **Ref:** Technical Architecture §6.5

- [x] **P0** tRPC procedure: `review.getDailyQueue(userId)`:
  1. Query `user_concept_state` where `retrievability < 0.9` (sorted ascending — most likely to forget first)
  2. Cap at user's daily budget (default 20, from `users.preferences`)
  3. Mix ratio: 80% due reviews + 20% new concepts
  4. Return with associated questions from pre-generated quiz bank
- [ ] **P0** Cache daily queue in Redis (Upstash) — regenerate once per day or on-demand if queue depleted
- [ ] **P1** Background cron job: pre-compute queues at midnight user-local-time

**Acceptance:** Queue returns correct concepts sorted by urgency. Queue respects daily limit. Cached queue serves in < 50ms. After completing a review, the item is removed from the queue.

**Deps:** 4.3, 4.1

### 4.5 Review Session UI

> **Ref:** Design System §9.3

- [x] **P0** `/review` page — full-screen review session
- [x] **P0** Progress bar: `X of Y` with percentage
- [x] **P0** Question card: display question text, concept name, difficulty badge
- [x] **P0** Answer input: MCQ (radio buttons) or text area (short answer)
- [x] **P0** Submit → show correct answer + explanation + source citation
- [x] **P0** FSRS rating buttons: Again (1) / Hard (2) / Good (3) / Easy (4) — with predicted next interval shown
- [x] **P0** On rating: call `updateState`, advance to next card
- [x] **P0** Session complete screen: summary (X correct, Y incorrect, Z new concepts), streak update
- [x] **P1** "Show Hint" button — retrieves a relevant chunk as a hint
- [ ] **P1** Flashcard flip animation (§8)
- [x] **P1** Keyboard shortcuts: 1/2/3/4 for ratings, Enter to submit

**Acceptance:** Full review session: see question → answer → see result → rate → next card → session complete. FSRS state updates correctly. Progress bar advances. Session summary is accurate.

**Deps:** 4.4, 1.2

---

## Phase 1E — Knowledge Graph & Progress (Weeks 7–8)

> **Goal:** Visual knowledge graph. Progress tracking. Polish and integration.

### 5.1 Knowledge Graph Visualization

> **Ref:** Design System §6.5, Technical Architecture §6

- [x] **P0** `/graph` page — interactive knowledge graph canvas
- [x] **P0** Use `react-force-graph-2d` (or D3 force simulation) to render concept nodes + edges
- [x] **P0** Node rendering:
  - Size: scales with number of downstream dependencies
  - Color: mastery level color (§3.2)
  - Label: concept display name
- [x] **P0** Edge rendering:
  - `prerequisite`: solid arrow
  - `related_to`: dashed line
  - `part_of`: dotted line with diamond
- [x] **P0** Click node → side panel with concept detail (definition, mastery, source chunks, "Study this" action)
- [x] **P0** Zoom, pan, and basic interaction controls
- [x] **P1** Node states: pulsing ring (in-progress), glow (mastered), dashed red border (gap detected)
- [x] **P1** Filter by: learning object, domain, mastery range
- [ ] **P2** Minimap for large graphs

**Acceptance:** Graph renders all concepts from user's content. Nodes colored by mastery. Clicking a node shows detail. Graph is interactive (zoom/pan). 100+ nodes render without performance issues.

**Deps:** 2.8, 4.3

### 5.2 Progress Dashboard

- [x] **P0** Dashboard widgets (update Home page from §1.3 with real data):
  - Daily review card: actual due count from `getDailyQueue`
  - Streak counter: consecutive days with at least 1 review
  - Concepts by mastery level: bar chart (Unknown/Exposed/Practicing/Familiar/Proficient/Mastered)
- [x] **P0** `/stats` page — detailed progress:
  - Total concepts learned over time (line chart)
  - Mastery distribution (stacked bar)
  - Review accuracy by concept (table)
  - Study time (derived from `review_log` timestamps)
- [x] **P0** Use Recharts for all visualizations
- [ ] **P1** Streak flame animation (§8)
- [x] **P1** "Knowledge health" metric: % of concepts above 0.9 retrievability

**Acceptance:** Dashboard shows real data from user's review history. Charts render correctly. Streak calculation is accurate (timezone-aware).

**Deps:** 4.3, 4.4

### 5.3 Unit & Integration Tests

> Testing is not optional — these cover critical business logic that would silently break without coverage.

- [x] **P0** Unit tests for semantic chunking: verify chunk boundaries, overlap, token limits, metadata assignment
- [ ] **P0** Unit tests for RAG retrieval: verify hybrid scoring, metadata filtering, top-K ordering
- [x] **P0** Unit tests for mastery state machine: verify all transitions (§5.6 rules), edge cases (mastery can't go below 0 or above 5)
- [ ] **P0** Unit tests for daily queue generation: verify sorting by retrievability, daily budget cap, 80/20 mix ratio
- [ ] **P0** Integration test: full ingestion pipeline (upload → chunks → embeddings → concepts → summaries → status=ready)
- [ ] **P1** Integration test: review session (fetch queue → answer question → FSRS update → verify next review date)
- [x] **P1** Configure Vitest as test runner in monorepo

**Acceptance:** All unit tests pass. Integration tests cover the two critical paths (ingestion, review). CI pipeline runs tests on every PR.

**Deps:** 2.5, 3.1, 4.2, 4.3, 4.4

### 5.4 Integration & Polish

- [ ] **P0** Full end-to-end flow test: Sign up → Upload PDF → Wait for processing → View summary → Chat with mentor → Take quiz → Review flashcards → See progress
- [x] **P0** Error handling audit: every async operation has loading, error, and empty states
- [x] **P0** Toast notifications: upload complete, processing failed, review reminder
- [x] **P0** Loading skeletons: shimmer animation for all data-loading states (§8)
- [ ] **P0** Mobile responsiveness audit: test all pages at 375px, 768px, 1024px, 1440px
- [x] **P0** Accessibility audit: keyboard navigation, focus rings, ARIA labels, screen reader testing
- [~] **P1** Rate limiting on all tRPC procedures (Upstash Ratelimit) — in-memory rate limiting added to `/api/mentor` and `/api/ingest`; migrate to Upstash for distributed rate limiting
- [ ] **P1** Error tracking: Sentry integration
- [ ] **P1** Product analytics: PostHog integration (page views, feature usage events)
- [ ] **P1** LLM observability: Langfuse dashboard configured, all AI calls traced

**Acceptance:** A new user can complete the full learning loop without errors. No unhandled promise rejections in console. All pages pass Lighthouse accessibility > 90. Error states are informative and recoverable.

**Deps:** All previous

### 5.5 Observability & Monitoring

- [ ] **P1** Sentry — error tracking + performance tracing
- [ ] **P1** Langfuse — LLM call tracing (latency, tokens, cost per call, user feedback correlation)
- [ ] **P1** PostHog — event tracking: `content_uploaded`, `summary_viewed`, `mentor_message_sent`, `quiz_answered`, `review_completed`, `streak_achieved`
- [ ] **P1** Vercel Analytics — web vitals (LCP, FID, CLS)
- [ ] **P2** Alert rules: error rate spike, LLM latency > 5s, job queue depth > 100

**Acceptance:** All dashboards show real data after 1 day of usage. LLM costs trackable per user per feature.

**Deps:** 5.4

---

## Phase 1 Exit Criteria

Before moving to Phase 2, ALL of the following must be true:

- [ ] 100 beta users invited and actively using the platform
- [ ] Full loop works: upload → summarize → extract concepts → mentor chat → quiz → review → progress
- [ ] FSRS scheduling produces correct review intervals
- [ ] Daily review queue serves cached results in < 100ms
- [ ] LLM cost per user per month is < $1.00
- [ ] No critical bugs in error tracking (Sentry)
- [ ] D7 retention > 30% (users returning after 7 days)
- [ ] Average session duration > 5 minutes

---

## Phase 2 — Beta Features (Weeks 9–20) — High-Level

> Detailed task breakdown to be written after Phase 1 completion.

### Week 9–10: Advanced Learning Features

- [ ] Knowledge gap detection algorithm (§6.4)
- [ ] Goal-driven curriculum builder (§2 Feature #8)
- [ ] Explain-back mode (§2 Feature #10)

### Week 11–12: Mobile & Offline

- [ ] PWA configuration (manifest, service worker, offline caching)
- [ ] Offline review queue (IndexedDB)
- [ ] Push notifications for review reminders (Web Push API)

### Week 13–14: Additional Content Formats

- [ ] PPT/PPTX ingestion (`officeparser`)
- [ ] Word/DOCX ingestion (`officeparser`)
- [ ] Audio file ingestion (Whisper API)
- [ ] Web URL ingestion (Firecrawl or `@mozilla/readability`)

### Week 15–16: Analytics & Engagement

- [ ] Learning analytics dashboard (retention curves, efficiency metrics)
- [ ] Study streak mechanics + achievements
- [ ] Email reminders (Resend) for review nudges

### Week 17–18: Graph Enhancements

- [ ] Cross-subject concept connections
- [ ] Graph enrichment background jobs (transitive dependency inference)
- [ ] Improved graph visualization (clustering, search, filter)

### Week 19–20: Monetization

- [ ] Stripe integration for Pro tier ($15/month)
- [ ] Free tier usage limits (10 mentor messages/day, 5 quiz sessions, 3 uploads)
- [ ] Landing page + pricing page
- [ ] Waitlist → conversion funnel

---

## Phase 3 — Production (Weeks 21–36) — High-Level

> Detailed task breakdown to be written after Phase 2 completion.

- [ ] Collaborative study groups + shared knowledge graphs
- [ ] React Native mobile app (iOS + Android)
- [ ] Learn from work artifacts (code, Notion, Google Docs)
- [ ] API + integrations (Anki import/export, calendar sync, LMS)
- [ ] Enterprise features (team workspaces, admin dashboard, SSO)
- [ ] Infrastructure scaling (service extraction, Qdrant migration, read replicas)
- [ ] Compliance (GDPR data export/deletion, SOC2 preparation)

---

## Dependency Graph (Critical Path)

```
Phase 0 (Week 1)
  0.1 Repo/Tooling ──┬──→ 0.3 DB Schema ──→ 0.4 tRPC+Zod ──→ 1.1 Auth
  0.2 Supabase ──────┘                                          │
  0.5 Design System (v4 @theme) ──────────────────────────→ 1.2 Layout
  4.2 FSRS Engine (zero deps — can start Week 1)                │
                                                                │
Phase 1A (Week 2)                                               │
  1.1 Auth ──→ 1.2 Layout ──→ 1.3 Dashboard                    │
                    │                                           │
Phase 1B (Weeks 3-4)│                                           │
  2.1 Upload UI ────┤                                           │
  2.2 Job Queue ────┼──→ 2.3 PDF ──┬──→ 2.5 Chunking ─┬→ 2.6 Embeddings
  (Railway worker)  │   2.4 YouTube─┘        │         ├→ 2.7 Summarization
                    │                        │         └→ 2.8 Concept Extraction
                    │                        │                 │
                    │                  2.9 Content Detail UI ◄─┘
                    │
Phase 1C (Weeks 5-6)
  3.1 RAG Pipeline (needs 2.6) ──→ 3.2 Mentor Backend ──→ 3.3 Mentor UI
                                        │
Phase 1D (Weeks 5-6)                    │
  4.1 Quiz Gen (needs 2.8 + 3.1)       │
  4.2 FSRS (done) ──→ 4.3 Mastery (needs 2.8) ──→ 4.4 Daily Queue (needs 4.1)
                                                          │
                                                   4.5 Review UI

Phase 1E (Weeks 7-8)
  5.1 Knowledge Graph (needs 2.8 + 4.3)
  5.2 Progress Dashboard (needs 4.3 + 4.4)
  5.3 Unit & Integration Tests (needs 2.5, 2.8, 4.2, 4.3, 4.4)
  5.4 Integration & Polish (needs everything)
  5.5 Observability (needs 5.4)
```

---

## Notifications & Email Reminders — Setup Checklist

> **Status:** Cron route + UI complete. External service wiring is pending.  
> **Docs:** [How notifications work](./docs/notifications.md)

### Required before emails send in production

- [ ] **P1** Create a [Brevo](https://app.brevo.com) account and generate an API key
  - Add `BREVO_API_KEY=xkeysib-...` to `apps/web/.env.local` (local) and Vercel env vars (prod)
- [ ] **P1** Verify a sender domain in Brevo → Settings → Senders & IPs
  - Add `BREVO_SENDER_EMAIL=noreply@yourdomain.com` to env
- [ ] **P1** Set `CRON_SECRET` in Vercel project env vars (auto-set on Vercel Pro, otherwise `openssl rand -base64 32`)
- [ ] **P1** Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` in Vercel env vars so CTA links in emails are correct
- [ ] **P1** Deploy to Vercel — cron in `vercel.json` runs `/api/cron/email-reminders` every hour automatically

### Optional improvements (post-launch)

- [ ] **P2** Add unsubscribe token in email footer (one-click unsubscribe per CAN-SPAM / GDPR)
- [ ] **P2** Push notifications — register service worker, store Web Push subscriptions in DB, send via Web Push API
- [ ] **P2** Smart nudges — dedicated cron that checks `fsrsRetrievability < 0.7` and fires nudge emails
- [ ] **P3** Migrate cron to BullMQ (Upstash QStash) for per-user scheduling accuracy and retries
- [ ] **P3** Email open / click tracking via Brevo webhooks → analytics table

---

## Technical Debt Register

Track shortcuts taken during POC that must be addressed before Phase 2:

| #   | Debt Item                                                                  | Accepted In | Must Fix By     |
| --- | -------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | No automated E2E tests (Playwright)                                        | Phase 1     | Phase 2 Week 11 |
| 2   | FSRS uses default parameters (not personalized per-user)                   | Phase 1     | Phase 2 Week 9  |
| 3   | No cross-encoder re-ranking in RAG pipeline                                | Phase 1     | Phase 2 Week 13 |
| 4   | No semantic cache for LLM responses                                        | Phase 1     | Phase 2 Week 15 |
| 5   | No image/OCR support for scanned PDFs                                      | Phase 1     | Phase 2 Week 13 |
| 6   | Knowledge graph deduplication is basic (fuzzy match + embedding threshold) | Phase 1     | Phase 2 Week 17 |
| 7   | No backup/restore strategy beyond Supabase defaults                        | Phase 1     | Phase 2 Week 19 |
| 8   | No content moderation on uploads (OpenAI Moderation API)                   | Phase 1     | Phase 2 Week 9  |

---

_This TODO is a living document. Update task statuses as work progresses. Add new tasks as requirements emerge. Never remove completed tasks — they serve as an implementation audit trail._
