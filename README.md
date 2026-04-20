# LearnGraph

AI-powered learning platform that transforms any content into a personalized, retention-optimized learning experience. Upload material, get AI-generated courses, study with adaptive quizzes, and retain knowledge with spaced repetition — all shaped by your learner profile.

---

## Features

### Content Ingestion

| Format                     | How it works                                        |
| -------------------------- | --------------------------------------------------- |
| **PDF**                    | Full text extraction via `unpdf` with page-aware chunking |
| **YouTube**                | Innertube captions API transcription                |
| **PowerPoint (PPTX)**      | Slide text + speaker notes via `officeparser`       |
| **Word (DOCX)**            | Heading-aware text extraction via `officeparser`    |
| **Audio (MP3, WAV, M4A)**  | Whisper API transcription → standard pipeline       |
| **Web URL**                | Mozilla Readability article extraction (SSRF-safe via `linkedom`) |
| **Image (PNG, JPG, WebP)** | GPT-4o vision OCR + content description             |

All formats flow through the same pipeline: **extract → chunk → embed → summarize → extract concepts → generate quizzes**.

Chunking: headers → paragraphs → sentences, 512 max tokens, 100 overlap (`js-tiktoken`). Concept deduplication at ≥ 0.92 cosine similarity.

### Modular Course System (V2)

Set a learning goal → AI generates a full hierarchical **Course → Module → Lesson → Block** structure. Six learning modes (understand first, remember longer, apply faster, deep mastery, exam prep, mentor heavy) with seven block types (concept, worked example, checkpoint, practice, reflection, scenario, mentor).

- **Adaptive path engine**: mastery gates, module unlocking, skip eligibility, catch-up suggestions, welcome-back detection
- **Setup wizard**: mode selection, topic clustering (Foundations / Core / Advanced), structure preview
- **Lesson player**: all block type renderers with transition animations and scaffold fading
- **FSRS integration**: block completion updates concept state + review log

### AI Mentor

Socratic tutor with persona adapted to your learner profile. RAG-grounded in uploaded material with streaming responses and source citations. Tool calling for knowledge checks and quiz generation. Compressed system prompt for efficient token usage.

### AI Summaries

Instant TL;DRs, key-point breakdowns, and expert-level deep summaries — 3-tier summarization.

### Smart Quizzes & Flashcards

Auto-generated MCQ, short-answer, fill-in-the-blank, and explain-back questions. Difficulty-adaptive — questions match your mastery level. Community quality control via thumbs up/down with auto-exclusion.

### Spaced Repetition (FSRS-5)

Daily review queue powered by the FSRS-5 algorithm. 80/20 split: due reviews sorted by lowest retrievability + new concepts. Difficulty ramping matches questions to your mastery bracket.

### Knowledge Graph

Force-directed 2D visualization (`react-force-graph-2d` + `d3-force`) of all your concepts. Mastery-colored nodes (Unknown → Mastered), edge types (prerequisite, related, part-of), zoom/filter controls, and a detail panel per concept.

### Cross-Source Knowledge Connections

Concepts automatically link across all your uploads via embedding similarity (≥ 0.92 cosine threshold). Related content panel shows which materials share concepts. Graph view highlights cross-source nodes.

### Smart Discovery Feed

Personalized home page that learns from user behavior:
- **For You**: AI-generated topics using learner profile
- **Trending**: aggregated from recent learning goals
- **Fill the Gap**: weak prerequisite concepts from knowledge graph
- **Surprise Me**: random concept with AI-generated curiosity hook
- Dismissals persisted in DB and excluded from future suggestions

### Learner Profile System

Adaptive profile that changes how the entire app behaves per user:
- **Declared**: education stage, languages, communication style, explanation depth, mentor tone, expertise domains, learning motivations, accessibility needs
- **Inferred**: pace, reading level, Bloom ceiling, optimal session length (calibrated from review sessions)
- Applied to mentor persona, curriculum generation, and question difficulty

### Knowledge Gap Detection

Compare your mastery against target concept sets. Prerequisite-ordered gap waterfall. Priority scoring by downstream dependency count × mastery deficit × retrievability decay.

### Explain-Back Mode

Teach a concept back to the AI. It evaluates accuracy, completeness, clarity, and catches misconceptions. Highest mastery boost in the FSRS scheduler.

### Practice Exams

Timed, randomized question sets from all studied content. No hints, no immediate feedback — real exam simulation.

### Gamification

XP awards, streak tracking (timezone-aware), achievement badges (first module, first course, block milestones). Block and course completion trigger gamification events.

### Export & Portability

| Export              | Formats                                          |
| ------------------- | ------------------------------------------------ |
| **Summaries**       | Markdown, JSON                                   |
| **Flashcards**      | Anki-compatible TSV, Markdown, JSON              |
| **Knowledge Graph** | JSON, CSV, Markdown (concepts + edges + mastery) |
| **Conversations**   | Markdown (citations preserved), JSON             |
| **Bulk Data**       | Full JSON export (GDPR-ready)                    |

Accessible via `/export` page or `GET /api/export?type=...&format=...`.

### Email Reminders

Cron-triggered email reminders via Brevo transactional API for study streak maintenance and review nudges.

### PWA Support

Installable progressive web app with offline fallback page, standalone display, and app manifest.

---

## Architecture

| Package           | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (App Router, Turbopack, Tailwind v4, shadcn/ui, Radix)                 |
| `packages/db`     | Drizzle ORM + Supabase Postgres + pgvector                                         |
| `packages/ai`     | Vercel AI SDK, LLM orchestration, ingestion pipeline, curriculum generation        |
| `packages/fsrs`   | FSRS-5 spaced repetition scheduler (pure algorithm, zero external deps)            |
| `packages/shared` | Types, constants, utilities, Upstash cache/rate-limit helpers                      |

| Layer     | Technology                                                                                  |
| --------- | ------------------------------------------------------------------------------------------- |
| **Auth**  | Supabase (email/password, Google, GitHub OAuth, magic link)                                 |
| **API**   | tRPC v11 with Zod validation (12 routers: health, library, mentor, review, user, goals, export, gamification, analytics, gaps, discovery) |
| **State** | TanStack Query (server) + React state/Context (client)                                      |
| **LLM**   | Configurable provider — GPT-5 Nano / GPT-5 Mini (OpenAI default) or Claude Sonnet 4.5 (Anthropic), text-embedding-3-small (1536 dims) |
| **Cache** | Upstash Redis (rate limiting, response caching, embedding cache)                            |
| **Email** | Brevo transactional API                                                                     |
| **Analytics** | Vercel Analytics + Speed Insights                                                       |

### Key Libraries

React 19, TypeScript 6, Node 24, Motion (Framer Motion), Recharts, Mermaid, Shiki (syntax highlighting), react-markdown, react-dropzone, abcjs (music notation), Vitest.

### Routes

**Pages** (App Router, `(app)` route group):

| Route | Purpose |
| ----- | ------- |
| `/` | Smart discovery feed (home) |
| `/library` | Content library grid with upload dialog |
| `/library/[id]` | Content detail: summary, chat, quizzes, flashcards, concepts, related |
| `/course/[goalId]` | Course roadmap with module cards and progress |
| `/course/[goalId]/learn` | Block-by-block lesson player |
| `/goals` | Learning goals management |
| `/review` | Spaced repetition review queue |
| `/graph` | Knowledge graph visualization |
| `/gaps` | Knowledge gap analysis |
| `/mentor` | AI mentor overview |
| `/mentor/chat` | Streaming mentor conversation |
| `/exam` | Practice exam mode |
| `/stats` | Mastery distribution, review history, streaks |
| `/achievements` | Badges and milestones |
| `/journal` | Learning journal |
| `/export` | Data export interface |
| `/settings` | Study preferences, learner profile, notifications |
| `/onboarding` | First-time user setup |
| `/more` | Navigation overflow |

**API Routes:**

| Route | Purpose |
| ----- | ------- |
| `/api/trpc/[trpc]` | tRPC handler (all 12 routers) |
| `/api/ingest` | Content ingestion pipeline trigger |
| `/api/mentor` | Streaming AI mentor (persona-adapted) |
| `/api/learn/start-v2` | Modular course generation |
| `/api/learn/session-v2` | Block-driven learning session (SSE) |
| `/api/learn/suggest-topics` | Topic suggestions |
| `/api/learn/teasers` | Course preview teasers |
| `/api/learn/ask` | Ask question during learning |
| `/api/learn/explain` | Explain-back evaluation |
| `/api/export` | Content export |
| `/api/cron/email-reminders` | Cron-triggered email reminders |
| `/api/admin/invite` | Admin invitation system |

---

## Development

```bash
pnpm install                          # install all dependencies
pnpm dev                              # start dev server (Turbopack)
pnpm build                            # production build
pnpm lint                             # lint all packages
pnpm format                           # format all files
pnpm typecheck                        # type-check all packages
pnpm --filter @repo/db db:generate    # generate Drizzle migrations
pnpm --filter @repo/db db:migrate     # run migrations
pnpm --filter @repo/db db:studio      # open Drizzle Studio
pnpm --filter @repo/fsrs test         # FSRS unit tests
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

- **Supabase**: project URL, anon key, service role key, database URL
- **AI Provider**: `LLM_PROVIDER` (`openai` or `anthropic`), API keys, model overrides
- **Upstash Redis**: REST URL + token (caching and rate limiting)
- **Brevo**: API key + verified sender email (transactional emails)
- **Cron**: secret for protecting cron endpoints

---

## Docs

| Document | Description |
| -------- | ----------- |
| [CLAUDE.md](./CLAUDE.md) | AI agent instructions and engineering guidelines |
| [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md) | Full data models, AI pipeline, system design |
| [modular-courses.md](./docs/modular-courses.md) | V2 modular course system architecture |
| [feature-status.md](./docs/feature-status.md) | Implementation status tracker |
| [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | Colors, typography, component patterns, animations |
| [PERFORMANCE_PLAN.md](./docs/PERFORMANCE_PLAN.md) | Performance optimization plan and status |
| [TODO.md](./docs/TODO.md) | Implementation roadmap with dependency graph |
| [TODO-NEW-FEATURES.md](./docs/TODO-NEW-FEATURES.md) | Feature roadmap |
