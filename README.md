# LearnGraph

AI-powered learning platform that transforms any content into a personalized, retention-optimized learning experience.

---

## Features

### Content Ingestion

| Format                     | How it works                                        |
| -------------------------- | --------------------------------------------------- |
| **PDF**                    | Full text extraction with page-aware chunking       |
| **YouTube**                | Auto-transcription via captions or Whisper fallback |
| **PowerPoint (PPTX)**      | Slide text + speaker notes extraction               |
| **Word (DOCX)**            | Heading-aware text extraction                       |
| **Audio (MP3, WAV, M4A)**  | Whisper API transcription → standard pipeline       |
| **Web URL**                | Mozilla Readability article extraction (SSRF-safe)  |
| **Image (PNG, JPG, WebP)** | GPT-4o vision OCR + content description             |

All formats flow through the same pipeline: **extract → chunk → embed → summarize → extract concepts → generate quizzes**.

### AI Summaries

Instant TL;DRs, key-point breakdowns, and expert-level deep summaries — 3-tier summarization powered by Claude.

### AI Mentor

A Socratic tutor that asks guiding questions, adapts to your level, and scaffolds understanding. RAG-grounded in your uploaded material with tool calling for knowledge checks and quiz generation. Streaming responses with source citations.

### Smart Quizzes & Flashcards

Auto-generated MCQ, short-answer, fill-in-the-blank, and explain-back questions. Difficulty-adaptive — questions match your mastery level. Community quality control via thumbs up/down with auto-exclusion.

### Spaced Repetition (FSRS-5)

Daily review queue powered by the FSRS-5 algorithm. 80/20 split: due reviews sorted by lowest retrievability + new concepts. Difficulty ramping matches questions to your mastery bracket.

### Knowledge Graph

Force-directed 2D visualization of all your concepts. Mastery-colored nodes (Unknown → Mastered), edge types (prerequisite, related, part-of), zoom/filter controls, and a detail panel per concept.

### Cross-Source Knowledge Connections

Concepts automatically link across all your uploads via embedding similarity (≥ 0.92 cosine threshold). Related content panel shows which materials share concepts. Graph view highlights cross-source nodes with a golden ring toggle. Connection discovery toasts after ingestion.

### Learning Goals & Curriculum

Set a goal ("Learn calculus for my exam") → AI generates a sequenced curriculum. Teach → check → explain-back session flow. Progress tracking per goal with curriculum items.

### Knowledge Gap Detection

Compare your mastery against target concept sets. Prerequisite-ordered gap waterfall. Priority scoring by downstream dependency count × mastery deficit × retrievability decay.

### Explain-Back Mode

Teach a concept back to the AI. It evaluates accuracy, completeness, clarity, and catches misconceptions. Highest mastery boost in the FSRS scheduler.

### Export & Portability

| Export              | Formats                                          |
| ------------------- | ------------------------------------------------ |
| **Summaries**       | Markdown, JSON                                   |
| **Flashcards**      | Anki-compatible TSV, Markdown, JSON              |
| **Knowledge Graph** | JSON, CSV, Markdown (concepts + edges + mastery) |
| **Conversations**   | Markdown (citations preserved), JSON             |
| **Bulk Data**       | Full JSON export (GDPR-ready)                    |

Accessible via `/export` page or `GET /api/export?type=...&format=...` API.

### Practice Exams

Timed, randomized question sets from all studied content. No hints, no immediate feedback — real exam simulation.

### Stats & Streaks

Mastery distribution, review history, streak tracking (timezone-aware), and recent activity.

---

## Architecture

| Package           | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (App Router, Turbopack, Tailwind v4, shadcn/ui)                         |
| `packages/db`     | Drizzle ORM + Supabase Postgres + pgvector                                         |
| `packages/ai`     | Vercel AI SDK, Claude Sonnet 4.5, OpenAI (embeddings/fallback), ingestion pipeline |
| `packages/fsrs`   | FSRS-5 spaced repetition scheduler (pure algorithm, zero deps)                     |
| `packages/shared` | Types, constants, utilities shared across all packages                             |

**Auth:** Supabase (email, OAuth, magic link)
**API:** tRPC v11 with Zod validation
**State:** TanStack Query (server) + React state/Context (client)
**LLM:** Claude Sonnet 4.5 (primary), GPT-4.1-mini (fallback), text-embedding-3-small (1536 dims)

---

## Development

```bash
pnpm install       # install all dependencies
pnpm dev           # start dev server (Turbopack)
pnpm build         # production build
pnpm lint          # lint all packages
pnpm format        # format all files
```

See [CLAUDE.md](./CLAUDE.md) for full engineering guidelines.
See [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) for system design.
See [TODO-NEW-FEATURES.md](./TODO-NEW-FEATURES.md) for the feature roadmap.
