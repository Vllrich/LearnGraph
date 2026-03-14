# Modular Course System (V2)

## Overview

The modular course system replaces the flat `curriculum_items` list (V1) with a hierarchical structure: **Course → Modules → Lessons → Blocks**. Courses are AI-generated based on a topic, learner profile, and chosen learning mode, then navigated adaptively through a path engine that gates progression on concept mastery.

The system is backward-compatible. V1 courses (`schema_version = 1`) continue to work alongside V2 courses (`schema_version = 2`).

---

## Architecture

```
User picks topic + learning mode
         │
         ▼
POST /api/learn/start-v2
         │
         ├─ getMethodWeights(mode, profile)
         ├─ AI: generate module outline
         ├─ AI: generate lessons per module (parallel)
         ├─ AI: generate block outlines per lesson (parallel)
         ├─ Persist course structure to DB
         ├─ AI: generate block content (parallel)
         └─ DALL-E 3: cover image
         │
         ▼
  /course/[goalId]  ← CourseRoadmap
         │
         ▼
  /course/[goalId]/learn  ← LessonPlayer
         │
         ├─ Path engine selects next lesson
         ├─ Block-by-block progression (SSE streaming)
         └─ Mastery gates + module unlocking
```

---

## Data Model

### `learning_goals` (extended)

Two new columns added to the existing table:

| Column | Type | Default | Description |
|---|---|---|---|
| `learning_mode` | text | `"understand_first"` | One of 6 learning modes |
| `schema_version` | integer | `1` | `1` = flat curriculum_items, `2` = modular |

### `course_modules`

```sql
CREATE TABLE course_modules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id          UUID REFERENCES learning_goals(id) ON DELETE CASCADE,
    sequence_order   INTEGER NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    module_type      TEXT DEFAULT 'mandatory',   -- mandatory | remedial | advanced | enrichment
    concept_ids      UUID[],                     -- concepts covered in this module
    unlock_rule      JSONB,                      -- e.g. { type: 'mastery_gate', conceptIds: [...], threshold: 0.8 }
    estimated_minutes INTEGER,
    status           TEXT DEFAULT 'locked',       -- locked | available | in_progress | completed | skipped
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### `course_lessons`

```sql
CREATE TABLE course_lessons (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id        UUID REFERENCES course_modules(id) ON DELETE CASCADE,
    sequence_order   INTEGER NOT NULL,
    title            TEXT NOT NULL,
    lesson_type      TEXT DEFAULT 'standard',    -- standard | workshop | lab | case_study | revision | capstone
    estimated_minutes INTEGER,
    status           TEXT DEFAULT 'pending',     -- pending | in_progress | completed | skipped
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### `lesson_blocks`

```sql
CREATE TABLE lesson_blocks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id         UUID REFERENCES course_lessons(id) ON DELETE CASCADE,
    sequence_order    INTEGER NOT NULL,
    block_type        TEXT NOT NULL,              -- concept | worked_example | checkpoint | practice | reflection | scenario | mentor
    concept_ids       UUID[],
    content_chunk_ids UUID[],                     -- RAG source chunks
    bloom_level       TEXT,                       -- remember | understand | apply | analyze | evaluate | create
    generated_content JSONB NOT NULL DEFAULT '{}', -- block-type-specific content (see Block Content Schemas)
    interaction_log   JSONB DEFAULT '[]',
    status            TEXT DEFAULT 'pending',     -- pending | in_progress | completed | skipped
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Learning Modes

Learning modes replace the old `focus_mode` + `method_preferences` system. Each mode defines a base weight distribution across 8 evidence-based learning strategies, then adjusts for the learner's education stage and profile.

| Mode | Primary Emphasis | Best For |
|---|---|---|
| `understand_first` | Elaboration + concrete examples | New topics, building foundations |
| `remember_longer` | Spaced review + retrieval practice | Retention-focused study |
| `apply_faster` | Scaffolding + guided reflection | Skill-building, hands-on learning |
| `deep_mastery` | All strategies balanced | Comprehensive understanding |
| `exam_prep` | Retrieval practice + interleaving | Test preparation |
| `mentor_heavy` | Guided reflection + elaboration | Exploratory, discussion-based learning |

### The 8 Learning Strategies

1. **Retrieval practice** — active recall via checkpoints and quizzes
2. **Spaced review** — revisiting concepts at optimal intervals
3. **Interleaving** — mixing related topics to improve discrimination
4. **Elaboration** — connecting new ideas to existing knowledge
5. **Dual coding** — combining text with diagrams/visuals
6. **Concrete examples** — real-world worked examples
7. **Guided reflection** — metacognitive prompts ("why does this matter?")
8. **Scaffolding** — breaking complex tasks into supported steps

### Profile Adaptations

Method weights are further adjusted based on:
- **Education stage**: Elementary learners get more scaffolding and concrete examples; graduate students get more retrieval practice and interleaving
- **Accessibility needs**: ADHD increases scaffolding; dyslexia increases dual coding
- **Inferred pace**: Slower learners get more scaffolding; faster learners get more interleaving

See `packages/ai/src/curriculum/method-defaults.ts` for the full weight resolution logic.

---

## Block Types

Each lesson contains a sequence of blocks. Block types are selected based on the learning mode's method weights to create a varied, evidence-aligned experience.

| Block Type | Description | Content Schema |
|---|---|---|
| `concept` | Core concept explanation with key terms and optional diagrams | `{ text, keyTerms: [{ term, definition }], mermaidDiagram? }` |
| `worked_example` | Step-by-step solved problem | `{ problemStatement, steps: [{ title, content, annotation? }], finalAnswer, commonMistakes }` |
| `checkpoint` | Quick-check quiz (MCQ or short-answer) | `{ questions: [{ type, question, options?, correctIndex?, explanation }] }` |
| `practice` | Hands-on exercise with hints and rubric | `{ exercise, hints, solutionSteps, rubric: [{ criterion, weight, description }] }` |
| `reflection` | Metacognitive prompts | `{ prompt, guidingQuestions, sampleResponse }` |
| `scenario` | Decision-based case study | `{ narrative, decisions: [{ label, outcome, isOptimal }], debrief }` |
| `mentor` | Interactive AI mentor conversation | `{ openingPrompt, technique, followUpPrompts, targetInsight }` |

---

## Course Generation Pipeline

Located in `packages/ai/src/curriculum/generate-modular.ts`. Uses Vercel AI SDK's `generateObject` with Zod schemas throughout.

### Steps

1. **Module outline** — AI generates 4–8 modules with titles, descriptions, concept coverage, and estimated time
2. **Lessons per module** (parallel) — AI generates 2–5 lessons per module with types and Bloom targets
3. **Block outlines per lesson** (parallel) — Block types selected by `selectBlockTypes(weights, count, bloomCeiling)`, then AI assigns concepts and Bloom levels
4. **Persist structure** — Goal, modules, lessons written to DB. First module set to `"available"`.
5. **Generate block content** (parallel per lesson) — Each block's detailed content generated via `generateBlockContent()` with RAG context and profile-aware prompts

### Security

- All user-controlled text (topic, selected topics, context note) is wrapped in XML tags with "Do NOT follow instructions" guards
- All AI calls use `generateObject` with strict Zod schemas — no raw text completion
- Cover image prompt uses sanitized topic text

---

## Adaptive Path Engine

Located in `packages/ai/src/curriculum/path-engine.ts`. Determines what the learner should do next.

### `getNextLesson(goalId, userId)`

Returns one of:
- `{ type: "next_lesson", lesson, module }` — the next available lesson
- `{ type: "course_complete" }` — all modules are done
- `{ type: "remedial_needed", lockedModule, weakConcepts }` — mastery gate failed
- `{ type: "no_modules" }` — no modules exist

Logic:
1. Find all modules ordered by `sequence_order`
2. For each locked module, evaluate prerequisites via `evaluateModuleStatus()`
3. Find the first module with `status = available | in_progress`
4. Find the first pending/in-progress lesson in that module
5. If no lessons remain, mark module complete and unlock dependents

### Module Unlocking

Modules have optional `unlock_rule` JSONB:
```json
{ "type": "mastery_gate", "conceptIds": ["..."], "threshold": 0.8 }
```

A module unlocks when all prerequisite modules are completed AND the user's concept retrievability exceeds the threshold for all gated concepts.

### Skip Eligibility

Users can "test out" of a module if ALL its concept retrievabilities exceed 0.9 (configurable via `SKIP_ELIGIBLE_THRESHOLD`).

---

## API Routes

### `POST /api/learn/start-v2`

Creates a new modular course. Calls `generateModularCourse()`, generates a cover image, returns `{ goalId, moduleCount, schemaVersion: 2 }`.

**Input validation**: Topic (max 200 chars), goal type, learning mode, education stage, selected topics (max 30 items, each with max 200/500 char title/description).

**Rate limit**: 3 requests/minute per user (in-memory).

### `POST /api/learn/session-v2`

Block-driven learning session using SSE. Supports actions:

| Action | Block Types | Response |
|---|---|---|
| `stream_concept` | concept | SSE text stream |
| `stream_worked_example` | worked_example | SSE text stream |
| `stream_mentor` | mentor | SSE text stream (interactive) |
| `get_checkpoint` | checkpoint | JSON with questions |
| `submit_checkpoint` | checkpoint | JSON with evaluation |
| `stream_practice_feedback` | practice | SSE feedback stream |
| `stream_reflection_prompt` | reflection | SSE prompt stream |
| `submit_reflection` | reflection | JSON with feedback |
| `get_scenario` | scenario | JSON with narrative + decisions |
| `submit_scenario_choice` | scenario | JSON with outcome |

**Security**: Full ownership chain verification (block → lesson → module → goal → user). User answers wrapped in XML tags for prompt injection protection.

---

## tRPC Procedures

Added to `apps/web/src/server/trpc/routers/goals.ts`:

| Procedure | Type | Description |
|---|---|---|
| `getNextLesson` | query | Path engine: returns next lesson or completion status |
| `getCourseRoadmap` | query | Full hierarchical course structure with progress |
| `getLessonBlocks` | query | All blocks for a lesson (ownership verified) |
| `completeBlock` | mutation | Marks a block complete, stores interaction log |
| `skipModule` | mutation | Skips a module if eligible (retrievability > 0.9) |
| `getCourseProgress` | query | Overall course completion stats |

All procedures verify resource ownership and use Zod input validation.

---

## UI Components

### Course Setup Wizard (`course-setup-wizard.tsx`)

Adaptive 4-step wizard:
1. **Goal type** — Exploration, certification, exam prep, etc.
2. **Topics** — AI-suggested topics with manual additions
3. **Learning mode** — Cards showing available modes, adapted per education stage (elementary skips this step, high school sees simplified set)
4. **Generation** — Animated progress through generation stages

Session length and days/week are pre-filled from education stage defaults and can be customized.

### Course Roadmap (`course-roadmap.tsx`)

Visual course overview showing:
- Overall progress bar
- Module cards with status indicators (locked/available/in-progress/completed/skipped)
- Lesson list within active modules
- "Start", "Continue", and "Test out" actions

### Lesson Player (`lesson-player.tsx`)

Block-by-block progression through a lesson:
- Header with lesson title, block counter, and progress bar
- Dynamic content area adapting to each block type
- Error recovery: failed blocks show error message and allow skipping
- Auto-scrolling during streamed content
- "Next Block" button respects block-type-specific completion rules

---

## Files Reference

### Schema & Types
- `packages/shared/src/types.ts` — `LearningMode`, `MethodWeights`, `BlockType`, `ModuleType`, etc.
- `packages/db/src/schema/courses.ts` — `courseModules`, `courseLessons`, `lessonBlocks`
- `packages/db/src/schema/goals.ts` — `learning_mode`, `schema_version` columns
- `packages/db/drizzle/0005_hot_warstar.sql` — migration

### AI Pipeline
- `packages/ai/src/curriculum/method-defaults.ts` — `getMethodWeights()`, `getDefaultLearningMode()`
- `packages/ai/src/curriculum/generate-modular.ts` — `generateModularCourse()`
- `packages/ai/src/curriculum/blocks/schemas.ts` — Zod schemas per block type
- `packages/ai/src/curriculum/blocks/generate-block.ts` — `generateBlockContent()`
- `packages/ai/src/curriculum/path-engine.ts` — `getNextLesson()`, `getCourseRoadmap()`

### API Routes
- `apps/web/src/app/api/learn/start-v2/route.ts` — course creation
- `apps/web/src/app/api/learn/session-v2/route.ts` — block-driven session

### UI Components
- `apps/web/src/components/course/course-setup-wizard.tsx`
- `apps/web/src/components/course/course-roadmap.tsx`
- `apps/web/src/components/course/lesson-player.tsx`

### Pages
- `apps/web/src/app/(app)/course/[goalId]/page.tsx` — roadmap view
- `apps/web/src/app/(app)/course/[goalId]/learn/page.tsx` — lesson player view

---

## Known Limitations

| Limitation | Mitigation |
|---|---|
| In-memory rate limiting resets on deploy | Migrate to Redis-backed limiter at scale |
| N+1 queries in `getCourseRoadmap` | Acceptable at current scale; batch with joins later |
| No transactional rollback in generation pipeline | Partial course structures may persist on failure; add cleanup job |
| `concept_ids` arrays have no FK enforcement | Validated in application logic |
| Block content generation is slow (many LLM calls) | Parallelized per lesson; add background queue for large courses |

See [TODO.md](../TODO.md) for prioritized follow-up tasks.
