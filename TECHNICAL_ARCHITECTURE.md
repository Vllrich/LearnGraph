# Technical Architecture: AI-Powered Learning Platform (Codename: LearnGraph)

> **Date:** March 7, 2026
> **Author Role:** CTO / AI Systems Architect
> **Status:** POC Architecture Plan
> **Context:** Based on YouLearn.ai teardown and validated product opportunities from [AI Startup Research](./AI_STARTUP_RESEARCH.md)

---

## 1. Product Overview

### What We're Building

LearnGraph is an AI-powered learning platform that transforms any content into a personalized, retention-optimized learning experience. Unlike YouLearn.ai — which stops at summarization and basic quizzes — LearnGraph closes the full learning loop: **ingest → understand → practice → retain → master.**

### How It Improves YouLearn.ai

| YouLearn.ai Limitation | LearnGraph Solution |
|------------------------|---------------------|
| Summaries only — no teaching | AI Mentor that uses Socratic method, adaptive difficulty, scaffolded explanations |
| No retention science | FSRS-based spaced repetition with forgetting curve modeling |
| No personalization | Learning Graph that tracks what each user knows, forgot, and needs next |
| No curriculum generation | Goal-driven path builder: "I want to learn X" → full sequenced curriculum |
| One-size-fits-all AI | Adaptive Learner Profile: mentor tone, vocabulary, language, and depth adapt per user |
| No collaboration | Shared knowledge graphs, study groups, peer challenges |
| Limited formats (no PPT, Word, images) | Universal ingestion: PDF, video, audio, slides, PPT, Word, images, code, web pages |
| Restrictive free tier | Generous free tier to drive adoption; monetize on power features |
| No knowledge gap detection | Automatic gap analysis by overlaying user state onto concept dependency graph |

### Core Thesis

The defensible moat is the **Learning Graph** — a structured knowledge graph of concepts, dependencies, and learner states that compounds with every user interaction. Every feature (mentor, curriculum, spaced repetition, gap detection) is an application running on top of this graph. More users → better graph → better learning paths for everyone → network effects.

---

## 2. Core Features

### MVP (Phase 1 — POC)

| # | Feature | Purpose |
|---|---------|---------|
| 1 | **Universal Content Ingestion** | Upload PDF, YouTube links, audio, slides, PPT, Word, images, web URLs. Parse and chunk into structured learning objects. |
| 2 | **AI Summarization & Concept Extraction** | Generate multi-level summaries (TL;DR, detailed, expert). Extract key concepts and terms automatically. |
| 3 | **AI Mentor Chat** | Socratic teaching mode grounded in uploaded content. Asks questions, adapts explanations, scaffolds understanding. Not a chatbot — a tutor. |
| 4 | **Quiz & Flashcard Generation** | Auto-generate MCQ, short-answer, explain-back questions. FSRS-scheduled flashcard reviews. |
| 5 | **Personal Knowledge State** | Track what the user knows, what's decaying, what's never been tested. Visualize as a simple progress map. |
| 6 | **Daily Review Queue** | Spaced repetition queue: "Here are the 15 things you should review today." Optimized by FSRS forgetting curves. |
| 7 | **Basic Learning Graph** | Concept nodes extracted from content, with dependency edges. User's mastery level overlaid per node. |

### Beta (Phase 2)

| # | Feature | Purpose |
|---|---------|---------|
| 8 | **Goal-Driven Curriculum Builder** | User sets a learning goal → AI generates a sequenced curriculum, sourcing from uploaded content + web resources. |
| 9 | **Knowledge Gap Detection** | Compare user's knowledge state against a target (exam syllabus, job role, curriculum) → highlight gaps → generate targeted study plans. |
| 10 | **Explain-Back Mode** | User teaches the concept back to the AI. AI evaluates understanding, identifies misconceptions, provides corrective feedback. Triggers protégé effect. |
| 11 | **Cross-Subject Concept Connections** | Show how concepts from different uploads/subjects relate (e.g., statistics ↔ machine learning ↔ research methods). |
| 12 | **Mobile App (PWA)** | Offline-capable review queue, flashcard drills, and mentor chat on mobile. |

### Production (Phase 3)

| # | Feature | Purpose |
|---|---------|---------|
| 13 | **Collaborative Study Groups** | Shared knowledge graphs, real-time group study sessions with AI mediation. |
| 14 | **Peer Challenges & Leaderboards** | Quiz battles, streak mechanics, ranked explanations scored by community. |
| 15 | **Learning Analytics Dashboard** | Retention curves, study efficiency metrics, predicted exam readiness scores. |
| 16 | **Learn From Work Artifacts** | Connect codebases, Notion, Google Docs — AI teaches from your real work context. |
| 17 | **API & Integrations** | LMS integration (Canvas, Moodle), Anki import/export, calendar sync. |

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Web App      │  │  Mobile PWA  │  │  Browser Extension       │  │
│  │  (Next.js)    │  │  (PWA + RN)  │  │  (Content Capture)       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │
└─────────┼─────────────────┼──────────────────────┼─────────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Next.js API Routes / tRPC (monolith-first)                  │   │
│  │  + Rate Limiting + Auth Middleware + Request Validation       │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐
│  CORE SERVICES   │ │  AI SERVICES   │ │  BACKGROUND      │
│                  │ │                │ │  PROCESSING      │
│  • Auth          │ │  • Mentor      │ │                  │
│  • Content CRUD  │ │  • Summarizer  │ │  • Ingestion     │
│  • Progress      │ │  • Quiz Gen    │ │  • Embedding     │
│  • Review Queue  │ │  • Concept     │ │  • Graph Build   │
│  • Curriculum    │ │    Extractor   │ │  • FSRS Scheduler│
│  • Graph Ops     │ │  • RAG Engine  │ │  • Analytics     │
│                  │ │  • Gap Detect  │ │    Aggregation   │
└────────┬─────────┘ └───────┬────────┘ └────────┬─────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
│  ┌──────────────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │ Postgres          │  │  Redis   │  │  S3-Compatible   │        │
│  │ (Supabase + RLS   │  │  Cache + │  │  Object Storage  │        │
│  │  + pgvector)      │  │  Queues  │  │  (Raw Files)     │        │
│  └──────────────────┘  └──────────┘  └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**Modular monolith first, not microservices.** At POC/seed stage, a modular monolith deployed as a single service gives you iteration speed. The modules (content, AI, graph, review) are separated by clear interfaces so they can be extracted into services later when scaling demands it. Premature microservices at this stage is a startup-killer.

**tRPC over REST or GraphQL.** With a TypeScript full-stack (Next.js + Node), tRPC gives you end-to-end type safety with zero schema maintenance overhead. No code generation, no GraphQL resolver boilerplate. When you need a public API later, add REST endpoints alongside tRPC — they coexist fine.

**Supabase as the operational backbone.** Supabase gives you Postgres, auth, row-level security, real-time subscriptions, object storage, and edge functions in one managed platform. At POC stage, this eliminates 80% of infrastructure decisions. You can migrate to raw AWS/GCP later if needed — the data layer is standard Postgres.

**pgvector for POC, dedicated vector DB at scale.** At POC stage (0–1K users), Supabase's built-in pgvector extension is sufficient for vector search and eliminates an extra service to manage. This keeps the data layer unified and reduces ops overhead for a small team. When retrieval latency or filtering becomes a bottleneck (Phase 2+), extract to Qdrant (self-hostable, performant, supports payload filtering) or Pinecone (fully managed, zero-ops).

---

## 4. Technology Stack

### Frontend

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Web Framework** | **Next.js 16 (App Router)** | Server components for fast initial loads, streaming for AI responses, built-in API routes, excellent DX. The React ecosystem has the largest talent pool. |
| **UI Library** | **shadcn/ui + Tailwind CSS + Radix** | Not a component library — a copy-paste system. Full control, no dependency lock-in, accessible by default. Tailwind for rapid styling. |
| **State Management** | **TanStack Query + Zustand** | TanStack Query for server state (caching, invalidation, optimistic updates). Zustand for minimal client state (UI toggles, local preferences). No Redux bloat. |
| **Rich Text / Markdown** | **Tiptap** | For note-taking, annotation, and study note features. Extensible, collaborative-ready (CRDT support via Hocuspocus). |
| **Charts / Visualization** | **Recharts + D3 (knowledge graph)** | Recharts for dashboards and analytics. D3 or react-force-graph for the interactive knowledge graph visualization. |
| **Real-time** | **Supabase Realtime** | WebSocket subscriptions for collaborative features, live progress updates, study group sync. |
| **Mobile Strategy** | **PWA first → React Native later** | PWA covers 80% of mobile use cases (offline review queue, flashcards, mentor chat). Build React Native only when app store distribution becomes a growth lever (Phase 3). Share business logic via shared TypeScript packages. |

### Backend

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Language** | **TypeScript (Node.js)** | Full-stack type safety with the frontend. Largest ecosystem for web tooling. async/await is natural for I/O-heavy AI workloads. |
| **Framework** | **Next.js API Routes + tRPC** | Co-located with frontend for POC speed. tRPC for internal type-safe APIs. Add Hono or Fastify for standalone services when extracting microservices later. |
| **API Style** | **tRPC (internal) + REST (public/webhooks)** | tRPC for app ↔ server communication. REST for webhooks, integrations, and future public API. |
| **Background Jobs** | **BullMQ (Redis-backed)** | Reliable job queue for content ingestion, embedding generation, FSRS scheduling, analytics aggregation. Supports retries, priorities, rate limiting, scheduled jobs. **Must run on Railway/Render — Vercel serverless functions have execution time limits (max 60s Pro) and cannot host persistent workers.** |
| **File Processing** | **TypeScript-native (POC) → Python sidecar (if needed)** | Use `pdf-parse` for PDFs, `officeparser` for PPT/Word, Whisper API for audio/video transcription, `@Mozilla/readability` for web pages — all within the Node.js runtime. Eliminates a second language/runtime for a small team. Fall back to a Python sidecar only for edge cases (OCR-heavy PDFs via PyMuPDF, complex slide layouts) if TS libraries prove insufficient. |

### AI Layer

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Primary LLM** | **Claude Sonnet 4.5 (Anthropic)** | Best instruction-following for teaching/tutoring use cases. Strong at structured output (JSON for concept extraction, quiz generation). Competitive pricing. |
| **Fallback / Cost Tier** | **GPT-4.1-mini or GPT-5-mini (OpenAI)** | For high-volume, lower-complexity tasks: flashcard generation, simple summarization, classification. GPT-5-mini is the recommended replacement for gpt-4.1-mini. |
| **Embedding Model** | **OpenAI text-embedding-3-small** | Best cost/performance ratio for semantic search. 1536 dimensions. $0.02/1M tokens. Upgrade to text-embedding-3-large only if retrieval quality demands it. |
| **RAG Framework** | **LangChain.js (minimal) + custom retrieval** | Use LangChain only for document loaders and text splitters. Build custom retrieval pipeline (hybrid search: vector similarity + BM25 keyword matching). Don't over-abstract with LangChain's agent framework — it adds latency and debugging pain. |
| **Orchestration** | **Vercel AI SDK** | Streaming responses, tool calling, structured output parsing. Lightweight, production-tested, integrates natively with Next.js. Avoid LangGraph/CrewAI — too heavy for a POC. |
| **Vector Database** | **pgvector (POC) → Qdrant (scale)** | pgvector via Supabase keeps the data layer unified at POC stage — no extra service to manage. Extract to Qdrant (open-source, payload filtering, outperforms pgvector at scale) when retrieval latency demands it (Phase 2+). |
| **Speech/Audio** | **OpenAI Whisper API (or Deepgram)** | For transcribing uploaded audio/video content. Whisper for accuracy, Deepgram for speed + real-time. |

### Data Layer

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Relational DB** | **PostgreSQL (via Supabase)** | Users, content metadata, learning progress, graph structure, FSRS card states. RLS for data isolation. Supabase handles backups, connection pooling (PgBouncer), and migrations. |
| **Vector DB** | **pgvector (POC) → Qdrant (Phase 2+)** | pgvector extension in Supabase Postgres for POC — zero extra infra. Migrate to Qdrant when query volume or filtering complexity demands it. |
| **Object Storage** | **Supabase Storage (S3-compatible)** | Raw uploaded files (PDFs, audio, video). Signed URLs for secure access. Lifecycle policies for cost management. |
| **Cache** | **Redis (Upstash)** | Session cache, rate limiting, BullMQ job queue backend, frequently-accessed learning state (today's review queue). Upstash is serverless Redis — zero ops, pay-per-request. |
| **Search** | **Postgres full-text search (initial) → Meilisearch (later)** | For searching content library, concept names, notes. Postgres GIN indexes are sufficient for POC. Add Meilisearch when fuzzy search and faceting become important. |

### Infrastructure

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Cloud Provider** | **Vercel (app) + Railway (workers) + Supabase (data)** | Vercel for Next.js deployment (edge network, streaming, zero-config). Railway for BullMQ workers — required from day 1 since Vercel serverless cannot host persistent job processors. Workers run as a long-lived TypeScript process. Supabase for managed Postgres + storage + auth. Near-zero DevOps overhead at POC stage. |
| **Containerization** | **Docker** | For BullMQ workers and any services that need custom runtimes. The Next.js app deploys natively on Vercel without containers. At POC stage, Docker may not be needed at all since everything runs as TypeScript on Vercel + Railway. |
| **CI/CD** | **GitHub Actions** | Lint → test → build → deploy pipeline. Vercel auto-deploys from `main` branch. GitHub Actions for worker service deployment to Railway. |
| **Observability** | **Vercel Analytics + Sentry + PostHog** | Vercel Analytics for web vitals and performance. Sentry for error tracking and tracing. PostHog for product analytics (feature usage, funnels, retention). All three have generous free tiers. |
| **LLM Observability** | **Langfuse** | Track every LLM call: latency, token usage, cost, user feedback. Essential for optimizing AI costs and quality. Open-source, self-hostable, or cloud. |
| **Migration to AWS/GCP** | **Phase 3** | When you hit Vercel/Railway limits or need SOC2, migrate to ECS/Cloud Run. The modular architecture makes this a deployment change, not a rewrite. |

---

## 5. AI Architecture

### 5.1 Document Ingestion Pipeline

```
User Upload
    │
    ▼
┌──────────────────┐
│  File Type Router │
│  (detect format)  │
└────────┬─────────┘
         │
    ┌────┼────┬────────┬──────────┬───────────┐
    ▼    ▼    ▼        ▼          ▼           ▼
  PDF  Video  Audio   PPT/Word  Web URL    Code/Repo
    │    │      │        │         │           │
    ▼    ▼      ▼        ▼         ▼           ▼
pdf-parse YT-DLP Whisper office-  Firecrawl  Tree-sitter
         +Whisper  API   parser   /Jina       parser
    │    │      │        │         │           │
    └────┴──────┴────────┴─────────┴───────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Text Normalization  │
              │  + Markdown Convert  │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Semantic Chunking   │
              │  (not fixed-size!)   │
              │  - Section-aware     │
              │  - Overlap: 100 tok  │
              │  - Max: 512 tokens   │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
    ┌──────────────────┐  ┌──────────────────┐
    │  Embed Chunks    │  │  Extract Metadata │
    │  (text-embed-3)  │  │  (title, author,  │
    │  → Store pgvector│  │   topics, lang)   │
    └──────────────────┘  └──────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Concept Extraction  │
              │  (LLM structured     │
              │   output → JSON)     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Update Learning     │
              │  Graph (new nodes    │
              │  + dependency edges) │
              └─────────────────────┘
```

**Key design decisions:**

- **Semantic chunking, not fixed-size.** Fixed 512-token chunks break mid-sentence and destroy context. Use section headers, paragraph boundaries, and semantic similarity to find natural chunk boundaries. Fall back to recursive character splitting only when structure isn't detectable.
- **Chunk overlap of ~100 tokens.** Prevents losing context at boundaries. Critical for RAG retrieval quality.
- **Metadata-enriched chunks.** Every chunk stores: `source_doc_id`, `section_title`, `page_number`, `chunk_index`, `topic_tags`. This enables filtered retrieval (e.g., "search only within Chapter 3").
- **Async pipeline.** Ingestion runs as BullMQ background jobs. User sees "Processing..." with a progress indicator. Webhook or Supabase Realtime notifies the frontend when processing completes.

### 5.2 Summarization Strategy

Three-tier summarization, generated in a single LLM call with structured output:

| Level | Length | Purpose |
|-------|--------|---------|
| **TL;DR** | 2-3 sentences | Quick recall, notification preview |
| **Key Points** | 5-10 bullet points | Study review, concept map labels |
| **Deep Summary** | 500-1000 words | Full understanding, replaces re-reading |

**Implementation:**
- Use Claude Sonnet 4.5 with a system prompt that enforces the three-tier structure.
- For documents longer than the context window: summarize each section independently, then generate a meta-summary across section summaries (hierarchical summarization).
- Cache summaries in Postgres. Regenerate only if the source content changes.

### 5.3 Quiz Generation

**Quiz types (ordered by cognitive demand):**

1. **Recognition** — Multiple choice (lowest effort, good for initial exposure)
2. **Recall** — Fill-in-the-blank, term definition (medium effort)
3. **Application** — Short answer requiring applying concepts to scenarios (high effort)
4. **Synthesis** — Explain-back: "Teach this concept as if explaining to a beginner" (highest effort, triggers protégé effect)

**Generation pipeline:**
1. Retrieve relevant chunks for the target concept(s).
2. LLM generates questions with structured output: `{ question, type, options?, correct_answer, explanation, concept_ids[], difficulty: 1-5 }`.
3. Questions are linked to concept nodes in the learning graph.
4. Difficulty adapts based on user performance: >80% correct → increase difficulty. <60% → decrease + flag knowledge gap.

**Quality control:**
- Every generated question includes a `grounding_chunks[]` field — the source chunks that justify the correct answer. If the answer can't be grounded in the source material, the question is discarded.
- User feedback (thumbs up/down) feeds into a quality scoring model. Low-rated questions are excluded from future sessions.

### 5.4 Knowledge Graph Creation

**Automated concept extraction flow:**

1. During ingestion, the LLM extracts concepts from each chunk:
   ```json
   {
     "concepts": [
       {
         "name": "Gradient Descent",
         "definition": "An optimization algorithm that...",
         "prerequisites": ["Calculus", "Linear Algebra", "Loss Functions"],
         "related_to": ["Backpropagation", "Learning Rate"],
         "difficulty_level": 3,
         "bloom_taxonomy": "application"
       }
     ]
   }
   ```

2. Concepts are matched against existing graph nodes (fuzzy string matching + embedding similarity to handle synonyms: "ML" = "Machine Learning").

3. New nodes are created, edges are added for `prerequisite`, `related_to`, and `part_of` relationships.

4. Each concept node stores: chunk references (provenance), difficulty estimate, Bloom's taxonomy level, and per-user mastery state.

**Graph enrichment (background job):**
- Periodically, a batch job analyzes the full graph for implicit relationships (e.g., if A→B and B→C exist but A→C doesn't, infer the transitive dependency).
- Cross-user graph merging: when multiple users upload content about the same topic, their concept extractions are merged to build a richer, more accurate graph.

### 5.5 AI Mentor Conversation Loop

The mentor is **not** a generic chatbot. It follows a structured pedagogical loop:

```
┌─────────────────────────────────────────────────────┐
│                  MENTOR LOOP                         │
│                                                      │
│  1. ASSESS — What does the user know about this?     │
│     → Check knowledge state for related concepts     │
│     → Ask a diagnostic question                      │
│                                                      │
│  2. TEACH — Based on assessment, choose strategy:    │
│     → If new concept: explain with analogy + example │
│     → If partial understanding: Socratic questions   │
│     → If misconception: direct correction + contrast │
│                                                      │
│  3. PRACTICE — Generate a targeted exercise          │
│     → Difficulty matched to assessed level           │
│     → Grounded in uploaded content (RAG retrieval)   │
│                                                      │
│  4. VERIFY — Evaluate the response                   │
│     → Update mastery state for the concept           │
│     → If mastered: move to next concept              │
│     → If not: loop back to TEACH with new approach   │
│                                                      │
│  5. CONNECT — Link to related concepts               │
│     → "This is related to X, which you studied       │
│        last week. Can you see the connection?"        │
└─────────────────────────────────────────────────────┘
```

**Technical implementation:**
- System prompt encodes the pedagogical loop as a state machine.
- Conversation context includes: **learner persona block** (built from `learner_profiles`), user's knowledge state (from graph), relevant content chunks (from RAG), conversation history (last 20 turns), and the current teaching objective.
- **Persona block** (`buildPersonaBlock(profile)` in `packages/ai/src/mentor/persona.ts`) modulates: vocabulary level (from inferred reading level or education stage), communication style, explanation depth, tone, cross-domain analogies from expertise domains, motivation-based framing, Bloom's ceiling cap, pacing hints, and accessibility adaptations. All profile data is fetched in the same `Promise.all` as RAG retrieval — zero added latency.
- Tool calling: the mentor LLM has access to tools — `check_knowledge_state(concept)`, `retrieve_content(query)`, `generate_quiz(concept, difficulty)`, `update_mastery(concept, score)`.
- Streaming responses via Vercel AI SDK for real-time feel.

### 5.6 User Learning State Tracking

Every interaction updates the user's learning state:

| Event | State Update |
|-------|-------------|
| User reads a summary | Concept marked as `exposed` (lowest mastery) |
| User answers a quiz correctly | Concept mastery incremented; FSRS interval extended |
| User answers incorrectly | Concept mastery decremented; FSRS interval shortened; gap flagged |
| User completes explain-back | Highest mastery boost (protégé effect) |
| Time passes without review | FSRS decay model reduces estimated retention |
| User asks mentor about a concept | Concept marked as `in_progress` |

**Mastery levels per concept:**

| Level | Label | Meaning |
|-------|-------|---------|
| 0 | Unknown | Never encountered |
| 1 | Exposed | Seen summary/explanation but not tested |
| 2 | Practicing | Answered some questions, inconsistent accuracy |
| 3 | Familiar | Consistently correct on recall questions |
| 4 | Proficient | Correct on application/synthesis questions |
| 5 | Mastered | Can teach it back; passed spaced repetition threshold |

---

## 6. Learning Graph Design

### 6.1 Concept Nodes

Each concept in the graph is a node with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `name` | string | Human-readable concept name |
| `canonical_name` | string | Normalized name for deduplication |
| `definition` | text | AI-generated or user-provided definition |
| `aliases` | string[] | Alternative names ("ML", "Machine Learning") |
| `difficulty_level` | 1-5 | Estimated cognitive difficulty |
| `bloom_level` | enum | remember / understand / apply / analyze / evaluate / create |
| `domain` | string | Subject area ("computer_science.ml.optimization") |
| `source_chunks` | UUID[] | Content chunks that teach this concept |
| `embedding` | vector(1536) | Semantic embedding for similarity matching |

### 6.2 Edge Types (Dependency Mapping)

| Edge Type | Meaning | Example |
|-----------|---------|---------|
| `prerequisite` | Must understand A before B | Linear Algebra → Gradient Descent |
| `part_of` | A is a component of B | Epoch → Training Loop |
| `related_to` | Conceptually similar | Gradient Descent ↔ Adam Optimizer |
| `applied_in` | A is used within B | Calculus → Backpropagation |
| `contrasts_with` | A is often confused with B | Precision ↔ Recall |

### 6.3 Skill Tracking

Skills are **composite nodes** — aggregations of multiple concepts:

```
Skill: "Build a Neural Network from Scratch"
├── Concept: Linear Algebra (mastery: 4/5)
├── Concept: Calculus (mastery: 3/5)
├── Concept: Activation Functions (mastery: 5/5)
├── Concept: Loss Functions (mastery: 2/5)  ← GAP
├── Concept: Backpropagation (mastery: 1/5) ← GAP
└── Concept: Gradient Descent (mastery: 3/5)

Skill mastery: weighted average = 3.0/5
Bottleneck: Loss Functions, Backpropagation
Recommended next: Study Loss Functions (prerequisite for Backpropagation)
```

### 6.4 Gap Detection Algorithm

```
function detectGaps(userId, targetSkill):
    requiredConcepts = getConceptsForSkill(targetSkill)
    userState = getUserMasteryState(userId, requiredConcepts)

    gaps = []
    for concept in requiredConcepts:
        if userState[concept].mastery < concept.required_threshold:
            gaps.append({
                concept: concept,
                current_mastery: userState[concept].mastery,
                required_mastery: concept.required_threshold,
                priority: calculatePriority(concept, userState)
            })

    # Sort by topological order (prerequisites first)
    gaps = topologicalSort(gaps, prerequisiteEdges)

    return gaps
```

**Priority calculation considers:**
- How many downstream concepts depend on this gap (high fan-out = high priority)
- How far below threshold the user is (bigger gap = higher priority)
- FSRS predicted retention (decaying concepts get priority boost)
- User's study velocity in this domain (adapt to learning speed)

### 6.5 Review Scheduling (FSRS Integration)

**FSRS (Free Spaced Repetition Scheduler)** replaces SM-2 (Anki's 1987 algorithm). FSRS uses a machine learning model trained on millions of review records to predict optimal review intervals.

Per-concept review state:

| Field | Description |
|-------|-------------|
| `stability` | How long the memory will last (in days) |
| `difficulty` | Intrinsic difficulty of this concept for this user |
| `elapsed_days` | Days since last review |
| `scheduled_days` | Days until next scheduled review |
| `retrievability` | Predicted probability of correct recall right now (0-1) |
| `state` | new / learning / review / relearning |
| `reps` | Number of successful reviews |
| `lapses` | Number of times forgotten after being learned |

**Daily queue generation:**
1. Query all concepts where `retrievability < 0.9` (about to be forgotten).
2. Sort by `retrievability` ascending (most likely to forget first).
3. Cap at user's daily review budget (default: 20 cards, configurable).
4. Mix in new concepts (20% new / 80% review) to balance learning and retention.

---

## 7. Data Models

### 7.1 Users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    timezone        TEXT DEFAULT 'UTC',  -- IANA timezone (e.g. 'America/New_York'), detected from browser or set in onboarding
    onboarding      JSONB DEFAULT '{"completed": false}',
    preferences     JSONB DEFAULT '{}',  -- daily_review_limit, difficulty_preference, etc.
    subscription    TEXT DEFAULT 'free' CHECK (subscription IN ('free', 'pro', 'team')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 Learning Objects (Content)

```sql
CREATE TABLE learning_objects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    source_type     TEXT NOT NULL,  -- 'pdf', 'youtube', 'audio', 'pptx', 'url', 'code', 'text'
    source_url      TEXT,
    file_path       TEXT,           -- path in object storage
    raw_text        TEXT,           -- extracted full text
    status          TEXT DEFAULT 'processing',  -- processing, ready, failed
    metadata        JSONB DEFAULT '{}',  -- page_count, duration, language, etc.
    summary_tldr    TEXT,
    summary_key_points TEXT,
    summary_deep    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_object_id UUID REFERENCES learning_objects(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,
    content         TEXT NOT NULL,
    section_title   TEXT,
    page_number     INT,
    token_count     INT,
    embedding       vector(1536),   -- pgvector column; migrate to Qdrant at scale
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chunks_learning_object ON content_chunks(learning_object_id);
```

### 7.3 Concepts & Knowledge Graph

```sql
CREATE TABLE concepts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name  TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    definition      TEXT,
    aliases         TEXT[] DEFAULT '{}',
    difficulty_level INT DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
    bloom_level     TEXT DEFAULT 'understand',
    domain          TEXT,
    embedding       vector(1536),  -- semantic embedding for deduplication and similarity matching
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_concepts_canonical ON concepts(canonical_name);

CREATE TABLE concept_edges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID REFERENCES concepts(id) ON DELETE CASCADE,
    target_id       UUID REFERENCES concepts(id) ON DELETE CASCADE,
    edge_type       TEXT NOT NULL,  -- prerequisite, part_of, related_to, applied_in, contrasts_with
    confidence      FLOAT DEFAULT 1.0,
    source_origin   TEXT DEFAULT 'ai',  -- 'ai', 'user', 'curated'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, target_id, edge_type)
);
CREATE INDEX idx_edges_source ON concept_edges(source_id);
CREATE INDEX idx_edges_target ON concept_edges(target_id);

CREATE TABLE concept_chunk_links (
    concept_id      UUID REFERENCES concepts(id) ON DELETE CASCADE,
    chunk_id        UUID REFERENCES content_chunks(id) ON DELETE CASCADE,
    relevance_score FLOAT DEFAULT 1.0,
    PRIMARY KEY (concept_id, chunk_id)
);
```

### 7.4 Progress Tracking & FSRS State

```sql
CREATE TABLE user_concept_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    concept_id      UUID REFERENCES concepts(id) ON DELETE CASCADE,
    mastery_level   INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),

    -- FSRS fields
    fsrs_stability  FLOAT DEFAULT 0,
    fsrs_difficulty FLOAT DEFAULT 5.0,
    fsrs_elapsed_days FLOAT DEFAULT 0,
    fsrs_scheduled_days FLOAT DEFAULT 0,
    fsrs_retrievability FLOAT DEFAULT 0,
    fsrs_state      TEXT DEFAULT 'new',  -- new, learning, review, relearning
    fsrs_reps       INT DEFAULT 0,
    fsrs_lapses     INT DEFAULT 0,
    last_review_at  TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, concept_id)
);
CREATE INDEX idx_user_concept_review ON user_concept_state(user_id, next_review_at);

CREATE TABLE review_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    concept_id      UUID REFERENCES concepts(id) ON DELETE CASCADE,
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 4),  -- 1=again, 2=hard, 3=good, 4=easy
    review_type     TEXT NOT NULL,  -- flashcard, quiz, explain_back
    question_id     UUID,
    response_time_ms INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_review_log_user ON review_log(user_id, created_at);
```

### 7.5 Quizzes & Questions

```sql
CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_object_id UUID REFERENCES learning_objects(id) ON DELETE CASCADE,
    question_type   TEXT NOT NULL,  -- mcq, short_answer, explain_back, fill_blank
    question_text   TEXT NOT NULL,
    options         JSONB,          -- for MCQ: [{id, text, is_correct}]
    correct_answer  TEXT,
    explanation     TEXT,
    difficulty      INT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    concept_ids     UUID[] DEFAULT '{}',
    grounding_chunks UUID[] DEFAULT '{}',
    quality_score   FLOAT DEFAULT 1.0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id     UUID REFERENCES questions(id) ON DELETE CASCADE,
    answer_text     TEXT,
    is_correct      BOOLEAN,
    feedback        TEXT,           -- AI-generated feedback on the answer
    time_taken_ms   INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.6 Learner Profile

The `learner_profiles` table stores the multi-dimensional pedagogical model for each user. It drives all AI adaptation: mentor tone and vocabulary, curriculum method weighting, question difficulty scaling, and language of instruction.

```sql
CREATE TABLE learner_profiles (
    user_id                     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Declared: user sets these in Settings
    education_stage             TEXT NOT NULL DEFAULT 'self_learner'
                                    CHECK (education_stage IN ('elementary','high_school','university','professional','self_learner')),
    native_language             TEXT NOT NULL DEFAULT 'en',       -- ISO 639-1 code
    content_language            TEXT NOT NULL DEFAULT 'en',       -- language the mentor teaches in
    communication_style         TEXT NOT NULL DEFAULT 'balanced'
                                    CHECK (communication_style IN ('casual','balanced','formal')),
    explanation_depth           TEXT NOT NULL DEFAULT 'standard'
                                    CHECK (explanation_depth IN ('concise','standard','thorough')),
    mentor_tone                 TEXT NOT NULL DEFAULT 'encouraging'
                                    CHECK (mentor_tone IN ('encouraging','neutral','challenging')),
    expertise_domains           TEXT[] DEFAULT '{}',              -- subjects the user already knows well
    learning_motivations        TEXT[] DEFAULT '{}',              -- career | curiosity | exam | hobby | academic
    accessibility_needs         JSONB DEFAULT '{}',               -- { dyslexia, adhd, visualImpairment, reducedMotion }

    -- Inferred: calibrated by the system from review session behaviour
    inferred_reading_level      REAL,                             -- Flesch-Kincaid grade, null until calibrated
    inferred_optimal_session_min INT,                             -- observed focus sweet-spot in minutes
    inferred_bloom_ceiling      TEXT,                             -- highest Bloom's level consistently achieved
    inferred_pace               TEXT CHECK (inferred_pace IS NULL OR inferred_pace IN ('slow','medium','fast')),
    calibration_confidence      REAL DEFAULT 0,                   -- 0..1; use declared values below 0.3

    last_calibrated_at          TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

**Resolution order** (highest wins): goal-level override → inferred fields (when `calibration_confidence > 0.3`) → declared fields → system defaults.

**How each dimension is used:**

| Dimension | Used by |
|-----------|---------|
| `education_stage` | Curriculum method-defaults, mentor vocabulary level |
| `native_language` / `content_language` | Mentor bilingual term intros; curriculum language |
| `communication_style` | Mentor phrasing formality |
| `explanation_depth` | Mentor response length; curriculum description verbosity |
| `mentor_tone` | Mentor encouragement/challenge level |
| `expertise_domains` | Cross-domain analogies; prerequisite skipping in curriculum |
| `learning_motivations` | Example framing (career, curiosity, exam, hobby, academic) |
| `accessibility_needs` | Dyslexia: short paragraphs + bold terms; ADHD: micro-checkpoints; visual: text descriptions |
| `inferred_pace` | Mentor pacing hints; curriculum chunk granularity |
| `inferred_bloom_ceiling` | Caps question Bloom's level until learner is ready |

**API surface:**
- `trpc.user.getLearnerProfile` — fetches profile; auto-seeds from legacy `preferences.learnerProfile` on first call
- `trpc.user.updateLearnerProfile` — upserts declared fields; keeps `preferences.learnerProfile.educationStage` in sync for backward compat

### 7.7 Mentor Conversations

```sql
CREATE TABLE mentor_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    learning_object_id UUID REFERENCES learning_objects(id) ON DELETE SET NULL,
    title           TEXT,              -- auto-generated from first user message
    messages        JSONB NOT NULL DEFAULT '[]',  -- [{role, content, tool_calls?, citations?, created_at}]
    teaching_objective TEXT,           -- current pedagogical focus
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mentor_conv_user ON mentor_conversations(user_id, updated_at DESC);
```

### 7.8 Curriculum & Goals

```sql
CREATE TABLE learning_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    target_date     DATE,
    status          TEXT DEFAULT 'active',
    target_concepts UUID[] DEFAULT '{}',
    learning_mode   TEXT DEFAULT 'understand_first',  -- V2: one of 6 learning modes
    schema_version  INTEGER DEFAULT 1,                -- 1 = flat curriculum_items, 2 = modular
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- V1: Flat curriculum items (schema_version = 1)
CREATE TABLE curriculum_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         UUID REFERENCES learning_goals(id) ON DELETE CASCADE,
    sequence_order  INT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    concept_ids     UUID[] DEFAULT '{}',
    learning_object_id UUID REFERENCES learning_objects(id),
    estimated_minutes INT,
    status          TEXT DEFAULT 'pending',  -- pending, in_progress, completed, skipped
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_curriculum_goal ON curriculum_items(goal_id, sequence_order);
```

### 7.9 Modular Course Structure (V2)

For courses with `schema_version = 2`. See `docs/modular-courses.md` for full details.

```sql
CREATE TABLE course_modules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id          UUID REFERENCES learning_goals(id) ON DELETE CASCADE,
    sequence_order   INTEGER NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    module_type      TEXT DEFAULT 'mandatory',
    concept_ids      UUID[],
    unlock_rule      JSONB,
    estimated_minutes INTEGER,
    status           TEXT DEFAULT 'locked',
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_lessons (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id        UUID REFERENCES course_modules(id) ON DELETE CASCADE,
    sequence_order   INTEGER NOT NULL,
    title            TEXT NOT NULL,
    lesson_type      TEXT DEFAULT 'standard',
    estimated_minutes INTEGER,
    status           TEXT DEFAULT 'pending',
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lesson_blocks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id         UUID REFERENCES course_lessons(id) ON DELETE CASCADE,
    sequence_order    INTEGER NOT NULL,
    block_type        TEXT NOT NULL,
    concept_ids       UUID[],
    content_chunk_ids UUID[],
    bloom_level       TEXT,
    generated_content JSONB NOT NULL DEFAULT '{}',
    interaction_log   JSONB DEFAULT '[]',
    status            TEXT DEFAULT 'pending',
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Scalability Strategy

### Phase 1 (POC: 0–1K users) — Monolith

- Single Next.js app on Vercel.
- Single Supabase project (Postgres + Auth + Storage).
- pgvector extension enabled on Supabase Postgres (no extra service).
- BullMQ workers co-located with the app or on a single Railway service.
- **Total infra cost: ~$50-150/month.**

### Phase 2 (Beta: 1K–50K users) — Modular Monolith + Dedicated Services

- Extract file processing into a dedicated service (Python sidecar for OCR/complex formats) with auto-scaling.
- Migrate vector search from pgvector to dedicated Qdrant instance for performance isolation.
- Move BullMQ workers to dedicated instances (separate from the web server).
- Add Redis caching layer for hot data: user's daily review queue, active session knowledge states, popular content summaries.
- Implement connection pooling (Supabase already handles this via PgBouncer).
- Add CDN for static assets and cached AI responses.
- **Cache strategy:**
  - L1: In-memory (per-request, Vercel edge) — 0ms
  - L2: Redis (Upstash) — <5ms
  - L3: Postgres — <20ms
  - L4: LLM call — 500-3000ms (cached results stored in L2/L3)
- **Total infra cost: ~$500-2,000/month.**

### Phase 3 (Production: 50K–1M+ users) — Service Extraction

- Extract high-load modules into independent services:
  - **AI Service** (handles all LLM calls, RAG retrieval) — auto-scales independently.
  - **Ingestion Service** (file processing pipeline) — burst-scales for upload spikes.
  - **Graph Service** (knowledge graph queries, gap detection) — read-heavy, cacheable.
  - **Review Service** (FSRS scheduling, queue generation) — runs on cron + on-demand.
- Move to **ECS/Cloud Run** for container orchestration.
- Postgres read replicas for read-heavy graph queries.
- Qdrant cluster (3+ nodes) with replication (migrated from pgvector in Phase 2).
- Event-driven architecture with **SQS/SNS or Kafka** for inter-service communication.
- **Total infra cost: ~$5,000-20,000/month.**

### Why Not Microservices From Day 1

- At 2-3 engineers, microservices create more operational overhead than they solve.
- Distributed tracing, service mesh, API gateway management, schema synchronization — all of this is wasted effort when you're still figuring out product-market fit.
- The modular monolith pattern (clear module boundaries, dependency injection, shared database with schema separation) gives you 90% of the isolation benefits with 10% of the ops cost.
- **Rule of thumb:** Extract a service when a module needs to scale independently, has a different deployment cadence, or requires a different runtime (e.g., a Python sidecar for OCR-heavy file processing that TS libraries can't handle).

---

## 9. Mobile Strategy

### Phase 1: PWA (Progressive Web App)

**Why PWA first:**
- Covers 80% of mobile use cases without app store distribution.
- Single codebase (Next.js generates the PWA manifest and service worker).
- Offline-capable review queue: cache today's flashcards + review data in IndexedDB, sync when online.
- Push notifications for review reminders (Web Push API).
- Add-to-homescreen prompt on mobile browsers.

**PWA-optimized features:**
- Daily review queue (works offline)
- Flashcard drills (works offline)
- Mentor chat (requires connection, but shows cached conversations)
- Progress dashboard (cached, syncs periodically)

### Phase 2: React Native (When App Store Distribution Matters)

**Trigger to build native:**
- When user acquisition via app store search becomes a growth lever (typically >50K users).
- When iOS-specific features are needed (widgets for daily review reminder, Siri shortcuts, Apple Watch companion).

**Architecture:**
- Shared business logic in TypeScript packages (monorepo with Turborepo).
- React Native for UI layer.
- Expo for build/deploy pipeline (EAS Build + OTA updates).
- Offline-first architecture: SQLite (via expo-sqlite) for local review state, background sync with Supabase.

**What NOT to use:**
- Flutter: Different language (Dart), can't share code with the Next.js web app. Only makes sense if you're mobile-first, which we're not.
- Capacitor/Ionic: Web view wrappers feel janky. If we're going native, go properly native with React Native.

---

## 10. Security and Privacy

### Authentication & Authorization

| Concern | Solution |
|---------|----------|
| **Auth Provider** | Supabase Auth (supports email/password, Google, GitHub, Apple SSO). Magic link for frictionless onboarding. |
| **Session Management** | JWT with short expiry (1 hour) + refresh tokens. HttpOnly cookies, not localStorage. |
| **Authorization** | Supabase Row-Level Security (RLS). Every table has policies ensuring users can only access their own data. No application-level auth checks needed — the database enforces it. |
| **API Security** | Rate limiting (Upstash Ratelimit). CORS whitelist. Input validation (Zod schemas via tRPC). |

### Data Isolation

- **Strict tenant isolation via RLS:** Every query automatically filters by `user_id = auth.uid()`. Even if application code has a bug, the database won't leak data across users.
- **Vector DB isolation:** All embeddings stored with `user_id` metadata. All vector searches include a mandatory `user_id` filter (RLS in pgvector at POC; payload filter in Qdrant at scale). No cross-user retrieval is possible.
- **Object storage:** Files stored with path `/{user_id}/{file_id}`. Signed URLs with 1-hour expiry. No public access.

### Content Ownership

- Users own their uploaded content. We process it but never use it to train models or share it with other users (unless they opt into collaborative features).
- Clear data export: users can download all their data (content, progress, graph) at any time.
- Account deletion: hard delete all user data within 30 days, including vectors and stored files.

### AI / Model Safety

| Risk | Mitigation |
|------|-----------|
| **Hallucination** | All mentor responses grounded in RAG-retrieved chunks. Confidence scoring: if retrieval similarity is below threshold, the mentor says "I don't have enough information about this in your materials." |
| **Prompt injection** | User input is never interpolated into system prompts. Separate user message from system context. Input sanitization for known injection patterns. |
| **Harmful content** | Content moderation on uploads (OpenAI Moderation API or Anthropic's built-in safety). Mentor refuses to generate harmful, illegal, or academic dishonesty content. |
| **Data sent to LLM providers** | Only content chunks are sent to LLMs, never full documents. No PII in LLM calls. Anthropic and OpenAI both offer zero-data-retention API tiers. |

### Compliance Readiness (Phase 3)

- GDPR: Data export, deletion, consent management. Supabase is EU-hosted option available.
- SOC2: When enterprise customers require it. Start the audit process ~6 months before you need the cert.
- FERPA: If targeting K-12/university institutional sales. Requires specific data handling agreements.

---

## 11. MVP Roadmap

### Phase 1 — POC (Weeks 1–8)

**Goal:** Validate the core loop: upload → learn → retain. Get 100 beta users actively using daily review.

| Week | Deliverable |
|------|-------------|
| **1-2** | Project scaffolding: Next.js + Supabase + tRPC + Tailwind. Auth flow (sign up, log in, onboard). File upload UI. Database schema v1. |
| **3-4** | Ingestion pipeline: PDF + YouTube processing. Chunking + embedding. Summarization (3-tier). Basic content library UI. |
| **5-6** | AI Mentor chat: RAG-powered conversation. Concept extraction from content. Basic knowledge graph (visual). Quiz generation (MCQ + short answer). |
| **7-8** | FSRS integration: spaced repetition scheduling. Daily review queue. Basic progress tracking. Knowledge state per concept. |

**Team:** 2 full-stack engineers + 1 AI/ML engineer. (3 people.)

**Exit criteria:** 100 users completing daily reviews for 2+ weeks. Retention D7 > 40%.

### Phase 2 — Beta (Weeks 9–20)

**Goal:** Validate differentiated features. Reach 1,000+ active users. Test willingness to pay.

| Week | Deliverable |
|------|-------------|
| **9-10** | Knowledge gap detection. Goal-driven curriculum builder. Explain-back mode. |
| **11-12** | PWA mobile support. Offline review queue. Push notification reminders. |
| **13-14** | Additional content formats: PPT, Word, audio, web URLs. Improved ingestion pipeline reliability. |
| **15-16** | Learning analytics dashboard. Retention curves. Study streak mechanics. |
| **17-18** | Cross-subject concept connections. Improved graph visualization. Learner Profile calibration loop (infer pace, reading level, Bloom ceiling from review sessions). |
| **19-20** | Payment integration (Stripe). Pro tier launch. Landing page + waitlist conversion. |

**Team:** 3 full-stack + 1 AI/ML + 1 designer. (5 people.)

**Exit criteria:** 1,000 MAU. 5% free → paid conversion. NPS > 40.

### Phase 3 — Production (Weeks 21–36)

**Goal:** Scale to 10K+ users. Launch collaborative features. Establish moat.

| Week | Deliverable |
|------|-------------|
| **21-24** | Collaborative study groups. Shared knowledge graphs. Real-time group study sessions. |
| **25-28** | React Native mobile app (iOS + Android). Offline-first architecture. App store launch. |
| **29-32** | Learn from work artifacts (code, Notion, Google Docs). API + integrations (Anki import, calendar sync). |
| **33-36** | Enterprise features (team workspaces, admin dashboard, SSO). Scalability hardening (service extraction, caching, read replicas). |

**Team:** 5 engineers + 1 AI/ML + 1 designer + 1 growth/marketing. (8 people.)

---

## 12. Cost Optimization

### LLM Cost is the #1 Expense — Here's How to Control It

**Projected LLM costs at scale:**

| Operation | Model | Tokens/Call | Calls/User/Day | Cost/User/Month |
|-----------|-------|-------------|-----------------|-----------------|
| Mentor chat | Claude Sonnet 4.5 | ~3K | 5 | $0.45 |
| Summarization | Claude Sonnet 4.5 | ~4K | 0.5 (on upload) | $0.06 |
| Quiz generation | GPT-4.1-mini | ~1K | 2 | $0.02 |
| Concept extraction | Claude Sonnet 4.5 | ~2K | 0.5 (on upload) | $0.03 |
| Embedding | text-embedding-3-small | ~500 | 1 | $0.001 |
| **Total** | | | | **~$0.56/user/month** |

At 10,000 users: **~$5,600/month in LLM costs.** Manageable if Pro tier is $12-20/month.

### Cost Reduction Strategies

**1. Aggressive caching**
- Cache summaries, concept extractions, and quiz questions in Postgres. Never regenerate what hasn't changed.
- Cache common mentor responses (FAQ-style questions about popular topics) in Redis. Check cache before LLM call.
- Semantic cache: embed the user's query, check if a similar query was already answered for the same content. If similarity > 0.95, return cached response.

**2. Model tiering**
- Use the cheapest model that meets quality requirements for each task:
  - Flashcard generation → GPT-4.1-mini or GPT-5-mini ($0.40/M input tokens)
  - Classification/routing → GPT-4.1-mini, GPT-5-mini, or local model
  - Teaching/mentoring → Claude Sonnet 4.5 (quality matters here)
  - Summarization of short docs → GPT-4.1-mini or GPT-5-mini; long/complex docs → Claude Sonnet 4.5

**3. Batch processing**
- Concept extraction, quiz generation, and summarization run as batch jobs during ingestion — not real-time. This allows batching multiple chunks into single LLM calls (cheaper per token).

**4. Response length control**
- System prompts enforce concise responses. A mentor response that rambles for 2,000 tokens when 400 would suffice costs 5x more.
- Use `max_tokens` parameter aggressively.

**5. Free tier throttling**
- Free users: 10 mentor messages/day, 5 quiz sessions/day, 3 uploads/day.
- These limits are primarily cost controls, not feature gates. The free tier should still be genuinely useful (attack YouLearn's biggest complaint).

**6. Pre-computation**
- Generate the daily review queue once per day (cron job at midnight user-local-time), not on-demand. Store in Redis. Serving a cached queue costs zero LLM tokens.
- Pre-generate quiz banks per learning object during ingestion. Serving a pre-generated quiz costs zero LLM tokens.

**7. Embedding cost reduction**
- Use `text-embedding-3-small` (1536 dimensions) not `large` (3072 dimensions). The quality difference is marginal for most use cases, but storage and compute costs halve.
- Embed chunks once during ingestion. Never re-embed unless content changes.

### Infrastructure Cost Summary (POC)

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Pro) | $20 |
| Supabase (Pro) | $25 |
| pgvector (included in Supabase) | $0 |
| Upstash Redis | $0-10 |
| Railway (BullMQ workers) | $5-15 |
| LLM APIs (100 users) | $50-100 |
| Langfuse (free tier) | $0 |
| Domain + misc | $15 |
| **Total** | **$90-180/month** |

This is a viable cost structure for a bootstrapped or pre-seed startup. LLM costs scale linearly with users but are controllable through the strategies above. At $15/month Pro pricing, you need ~15 paying users to cover infrastructure. Breakeven on LLM costs alone happens at ~5% conversion rate with 300 users.

---

## Appendix A: Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM concept extraction quality is inconsistent | Knowledge graph is unreliable | Human-in-the-loop review for top concepts. Confidence scoring. Multiple extraction passes with voting. |
| FSRS parameters need calibration per user | Suboptimal review scheduling | Default to FSRS-5 pretrained parameters. Personalize after 50+ reviews per user. |
| Vector search retrieval quality degrades with scale | Mentor gives irrelevant answers | Hybrid search (vector + BM25). Metadata filtering. Re-ranking with cross-encoder. |
| Users don't return for daily reviews | Core retention loop fails | Push notifications. Streak mechanics. Minimum viable review (5 cards/day = 2 minutes). Gamification. |
| Content ingestion fails on edge-case formats | User frustration, churn | Comprehensive error handling. Fallback to raw text extraction. User notification with retry option. |

---

## Appendix B: Build vs. Buy Decisions

| Component | Decision | Reasoning |
|-----------|----------|-----------|
| Auth | **Buy** (Supabase Auth) | Solved problem. Don't build auth in 2026. |
| File parsing | **Build** (TypeScript-native, Python sidecar for edge cases) | TS libraries cover 80% of formats. Add Python only for OCR-heavy PDFs or complex slides. Need control over chunking quality. |
| Vector DB | **Use** (pgvector POC) → **Buy** (Qdrant Cloud at scale) | pgvector is free inside Supabase Postgres at POC. Migrate to Qdrant when performance isolation is needed. |
| Spaced repetition | **Build** (FSRS implementation) | FSRS is open-source with reference implementations in TypeScript. ~200 lines of code. Critical to the product — must own this. |
| LLM orchestration | **Mostly build** (Vercel AI SDK + custom) | LangChain adds too much abstraction for too little value at this scale. Use Vercel AI SDK for streaming + tool calling. Build custom retrieval pipeline. |
| Analytics | **Buy** (PostHog) | Generous free tier. Event tracking, funnels, feature flags. Don't build analytics. |
| Payments | **Buy** (Stripe) | Obviously. |
| Email | **Buy** (Resend) | Transactional email for review reminders. $0 for 100 emails/day. |

---

*This architecture is designed to be built by a team of 3-5 engineers in 8-12 weeks for POC, with a clear path to scaling to millions of users without a rewrite. Every decision optimizes for iteration speed now and extraction later.*
