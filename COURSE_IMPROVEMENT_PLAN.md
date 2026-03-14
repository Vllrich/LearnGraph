# Course System Improvement Plan

> **Status:** Draft — March 2026
> **Context:** Evolving flat `learning_goals` + `curriculum_items` into an adaptive, modular course system inspired by [course-maker.md](./course-maker.md), leveraging our existing `learner_profiles`, concept graph, and FSRS infrastructure.

---

## 1. Current State vs Target

### What We Have

| Component | State |
|-----------|-------|
| `learning_goals` | Flat sequence of `curriculum_items` (title + description, no internal structure) |
| Curriculum generation | AI generates 8–15 items; methods like `guided_lesson`, `practice_testing`, `explain_back` — but each item is a single opaque step |
| Learner profiles | Rich declared + inferred dimensions (education stage, pace, Bloom ceiling, tone, accessibility) |
| Concept graph | `concepts` + `concept_edges` (prerequisite/related) + per-user `user_concept_state` with FSRS |
| Learning session | SSE streaming: teach → check → explain-back — but no variety in block types or branching |
| AI mentor | Persona-adapted via `buildPersonaBlock(profile)` — already consumes learner profile |

### What We Need (from the guide, filtered for our system)

| Guide Concept | Applicability | Why |
|---------------|---------------|-----|
| **Module → Lesson → Block hierarchy** | High | Replaces flat curriculum items with structured, reusable units |
| **Block-based lessons** (concept, checkpoint, practice, reflection, scenario, worked example) | High | Maps directly to our existing `learningMethod` types; gives the AI finer-grained generation targets |
| **Conditional branching / mastery gates** | High | We already have `user_concept_state` + concept prerequisites — branching is a natural extension |
| **Diagnostic entry** | High | Learner profiles + concept state can skip mastered prerequisites automatically |
| **Engagement loop** (action → feedback → progress → reward) | High | Replaces our linear teach→check→explain-back with a richer rhythm |
| **Path modes** (guided, accelerated, exam-prep) | Medium | Maps to `focusMode` + `goalType` we already store on `learning_goals` |
| **Block-level analytics / drop-off** | Medium | Needed later for iteration; not MVP |
| **Creator/builder UI** (Notion/Figma-like) | Low | We are AI-generated first; manual course building is Phase 3+ |
| **Social touchpoints** (peer review, discussion) | Low | Out of scope until collaborative features (Phase 3) |
| **A/B testing / content versioning** | Low | Premature at current scale |

---

## 2. Learning Methods Redesign

### 2.1 Problem with Current Methods

The current system exposes four raw sliders (`guidedLessons`, `practiceTesting`, `explainBack`, `spacedReview`) in the wizard. This has two issues:

1. **Incomplete method coverage.** The learning science literature supports at least eight evidence-based strategies. We're missing interleaving, elaboration, dual coding, concrete examples, scaffolding, and guided reflection.
2. **User-hostile UI.** Most learners don't know what "explain-back 25%" means. Exposing raw academic method names as percentage sliders creates friction and false precision.

### 2.2 Evidence-Based Method Set

Replace the four methods with eight core strategies that map to product behavior:

| Method | What It Does in Product | Block Types It Drives |
|--------|------------------------|----------------------|
| **Retrieval practice** | Lessons pause regularly; learner must recall before seeing the answer | `checkpoint`, `practice` |
| **Spaced review** | System resurfaces concepts after calibrated delays (FSRS) | `checkpoint` (review), scheduled review lessons |
| **Interleaving** | Related-but-different topics are mixed within a lesson instead of grouped | Block ordering algorithm within lessons |
| **Elaboration** | AI mentor asks "why?", "how?", "what connects?" — pushes deeper processing | `mentor` blocks, `reflection` blocks |
| **Dual coding** | Verbal explanations paired with diagrams, concept maps, timelines | `concept` blocks with visual generation, Mermaid diagrams |
| **Concrete examples** | Abstract ideas immediately followed by real-world applications and cases | `worked_example`, `scenario` blocks |
| **Guided reflection** | Learner summarizes understanding, identifies confusion, plans next review | `reflection` blocks |
| **Scaffolding** | System offers hints, partial steps, worked examples — fades support as mastery rises | `concept`→`worked_example`→`practice` progression; hint density driven by `user_concept_state` |

### 2.3 Product-Friendly Modes (Replacing Raw Sliders)

Instead of 4 sliders, the wizard presents **6 learner-facing modes** that map to method weight presets underneath. Users pick a mode; power users can still customize.

| Mode | Label | Description | Method Emphasis |
|------|-------|-------------|-----------------|
| `understand_first` | **Understand first** | Step-by-step explanations with visuals and examples | High: concrete examples, dual coding, scaffolding. Low: interleaving |
| `remember_longer` | **Remember longer** | Spaced repetition and frequent recall checks | High: retrieval practice, spaced review. Medium: interleaving |
| `apply_faster` | **Apply faster** | Projects, scenarios, and mixed practice | High: interleaving, concrete examples. Medium: elaboration |
| `deep_mastery` | **Deep mastery** | Hard questions, self-explanation, fewer hints | High: elaboration, interleaving, retrieval practice. Low: scaffolding |
| `exam_prep` | **Exam prep** | Compressed plan with frequent recall and spaced review | High: retrieval practice, spaced review, interleaving. Medium: concrete examples |
| `mentor_heavy` | **Mentor-heavy** | More AI check-ins, metacognitive prompts, intervention on drop-off | High: elaboration, guided reflection, scaffolding. Medium: retrieval practice |

**Resolution:**
1. `goalType` auto-selects a default mode (e.g., `exam_prep` goal → `exam_prep` mode)
2. Learner can override in wizard step 3
3. Profile dimensions further adjust: e.g., `accessibilityNeeds.adhd` bumps scaffolding weight up in any mode
4. The mode is stored on `learning_goals.learning_mode` — the underlying method weights are computed at generation time, not stored

### 2.4 Type Changes

```typescript
// Replace MethodPreferences with:
export type LearningMode =
  | "understand_first"
  | "remember_longer"
  | "apply_faster"
  | "deep_mastery"
  | "exam_prep"
  | "mentor_heavy";

export type MethodWeights = {
  retrievalPractice: number;   // 0–100
  spacedReview: number;
  interleaving: number;
  elaboration: number;
  dualCoding: number;
  concreteExamples: number;
  guidedReflection: number;
  scaffolding: number;
};

// LearningMode → MethodWeights resolved at generation time via getMethodWeights(mode, profile)
```

### 2.5 Age-Adaptive Mode Resolution

Not every learner should see the same wizard step 3. The `educationStage` from the learner profile determines **how much choice the user gets**:

| Education Stage | Wizard Step 3 Behavior | Rationale |
|-----------------|----------------------|-----------|
| **Elementary** (5–12) | **Skip entirely.** Mode auto-selected: `understand_first`. No cards shown. Summary step says "We picked the best approach for you." | Young learners can't meaningfully choose between learning strategies. Cognitive development research shows children benefit from high scaffolding + concrete examples + dual coding by default. Letting them choose adds confusion. |
| **High school** (13–18) | **Show 3 simplified modes** as cards: "Step by step" (`understand_first`), "Quiz me often" (`remember_longer`), "Challenge me" (`deep_mastery`). No customize section. | Teens can express a preference but shouldn't manage 8 method sliders. Simplified labels use their language, not academic jargon. Exam prep auto-activates if `goalType=exam_prep`. |
| **University** (18–25) | **Show all 6 modes.** Customize section available but collapsed. | College students can handle strategy choice. Most will pick a card and move on. |
| **Professional** | **Show all 6 modes.** Customize section available but collapsed. Default biased toward `apply_faster`. | Professionals want efficiency and practical application. |
| **Self-learner** | **Show all 6 modes + customize expanded by default.** | Self-directed learners are the power-user segment — they're most likely to want fine-grained control. |

**Method weight overrides per stage** (applied on top of mode defaults):

| Stage | Automatic Adjustments |
|-------|----------------------|
| Elementary | `scaffolding` +20, `dualCoding` +15, `concreteExamples` +15, `elaboration` −15, `interleaving` −10 |
| High school | `scaffolding` +10, `concreteExamples` +10, `retrievalPractice` +5 |
| University | No forced adjustments |
| Professional | `concreteExamples` +10, `scaffolding` −10 |
| Self-learner | No forced adjustments |

These adjustments are additive to the mode's base weights, then normalized to 100. They ensure elementary learners always get high scaffolding even if someone manages to set `deep_mastery`, and professionals always get real-world examples.

**Goal-type auto-mode mapping** (before user sees any cards):

| Goal Type | Elementary | High School | University+ |
|-----------|-----------|-------------|-------------|
| Exam prep | `understand_first` (no exam prep mode for kids) | `exam_prep` (auto, no choice) | `exam_prep` (pre-selected, changeable) |
| Skill building | `understand_first` | `apply_faster` | `apply_faster` |
| Course supplement | `understand_first` | `remember_longer` | `understand_first` |
| Exploration | `understand_first` | `understand_first` | `understand_first` |

### 2.6 What We Explicitly Avoid

- **Learning styles** ("visual learner", "auditory learner", "kinesthetic") — no scientific basis for style-matching. Instead, we provide multiple representations (dual coding) for everyone.
- **One-time preference quiz** — the system continuously calibrates via the assess→customize→feedback loop already built into `learner_profiles.calibrationConfidence`.
- **Exposing academic jargon to young users** — terms like "interleaving" and "elaboration" never appear in the UI for elementary/high school. The system applies them silently.

---

## 3. Course Creation UX Tunnel Redesign

### 3.1 Current Flow Problems

| Step | Current | Problem |
|------|---------|---------|
| 0 | Goal type (4 cards) | Good — keep |
| 1 | Familiarity (3 options) | Good — keep |
| 2 | AI suggests topics, user toggles | Good concept, but no sense of structure — just a flat checklist |
| 3 | Session length + days/week + 3 focus cards + 4 method sliders | Too much cognitive load; sliders are meaningless to most users |
| 4 | Summary + generate | Summary is good; generation feels opaque ("building your learning path...") |

### 3.2 Redesigned Flow (5 Steps)

**Step 0 — Purpose** (keep as-is)
- Goal type cards: Exam, Career, Course, Curious
- Conditional fields: exam name/date, target role, course name

**Step 1 — Familiarity** (keep as-is)
- Brand new / Some knowledge / Experienced

**Step 2 — Topics** (enhance)
- Keep AI-suggested topics with toggle/add/remove
- **New: show topics grouped into module previews** ("Foundations", "Core Concepts", "Advanced")
- Show prerequisite arrows between groups so the learner sees structure, not a flat list
- Estimated total time shown as "~4 weeks at 15min/day"

**Step 3 — Learning Mode** (adaptive per education stage — see §2.5)
- **Elementary**: step is skipped entirely, mode auto-resolved
- **High school**: 3 simplified mode cards ("Step by step", "Quiz me often", "Challenge me"). No customize panel. Session length + days/week shown inline.
- **University / Professional / Self-learner**: 6 mode cards with collapsible customize section (8 sliders + schedule). Self-learners see customize expanded by default.
- Default always pre-selected from `goalType` × `educationStage` mapping table (§2.5)
- **Exam prep + high school**: step is auto-resolved to `exam_prep` with a confirmation card ("We'll focus on practice questions and spaced review for your exam") instead of mode selection

**Step 4 — Review & Generate** (enhance)
- Summary cards (same as now, add learning mode — for elementary, show "Best approach for your age" instead of mode name)
- **New: show estimated course structure** before generating:
  - "~5 modules · ~18 lessons · ~65 blocks"
  - "Estimated completion: 3 weeks at 15min/day, 5 days/week"
- Generate button → animated progress showing actual generation stages:
  - "Mapping concepts..." → "Building modules..." → "Creating lessons..." → "Ready!"
- On completion, redirect to the new course roadmap view

### 3.3 Onboarding-to-Wizard Integration

For first-time users (no learner profile yet), inject a lightweight onboarding before the wizard:
1. Education stage (if not set) — **this is now critical** since it determines wizard behavior
2. "What matters most to you?" → maps to `learningMotivations`
3. "Any special needs?" → accessibility (optional, skippable)

This seeds the learner profile so the wizard can auto-select a good mode from the start. Returning users skip this — their profile already drives defaults.

### 3.4 Post-Creation: Continuous Adaptation

The learning mode isn't locked at creation time. The system suggests mode changes based on behavior:
- Learner consistently skips reflection blocks → suggest "Apply faster" mode
- Learner struggles with checkpoints → suggest "Understand first" mode
- Exam date approaching → suggest "Exam prep" mode
- These show as a gentle notification card on the course roadmap, not a forced change

---

## 4. Data Model & Engine Design

### 4.1 Data Model Evolution

Replace the flat `curriculum_items` list with a three-level hierarchy:

```
Course (learning_goals — renamed/extended)
  └─ Module (new: course_modules)
       └─ Lesson (new: course_lessons)
            └─ Block (new: lesson_blocks)
```

**Course** = a learning goal with metadata (outcomes, prerequisites, workload, skill map).

**Module** = a thematic group of lessons. Modules have a `module_type`:
- `mandatory` — core content
- `remedial` — inserted when prerequisites are weak
- `advanced` — unlocked after mastery gate
- `enrichment` — optional deep dive

**Lesson** = a single learning session (5–20 min). Contains ordered blocks.

**Block** = the atomic unit of learning. Block types:
- `concept` — short explanation (text, uses content chunks for grounding)
- `worked_example` — expert walkthrough of a problem
- `checkpoint` — quick recall/understanding check (1–3 questions)
- `practice` — repeatable exercises with instant AI feedback
- `reflection` — learner summarizes or explains back
- `scenario` — decision-based learning (branching mini-narrative)
- `mentor` — inline AI mentor interaction (hint, challenge, Socratic probe)

### 4.2 Learner Profile Integration Points

The profile already drives mentor persona and method defaults. The course system extends this:

| Profile Dimension | Course System Effect |
|-------------------|---------------------|
| `educationStage` | Controls vocabulary in generated blocks; defaults module depth |
| `explanationDepth` | `concise` → fewer concept blocks, more practice; `thorough` → more worked examples |
| `mentorTone` | Tone of checkpoint feedback and mentor blocks |
| `inferredPace` | Lesson length target (slow=8min, medium=12min, fast=18min); more/fewer blocks per lesson |
| `inferredBloomCeiling` | Caps scenario/practice complexity; gates advanced modules |
| `inferredOptimalSessionMin` | Module size calibration — never generate modules longer than observed focus sweet-spot |
| `accessibilityNeeds.adhd` | Insert micro-checkpoints every 2 blocks; shorter concept blocks |
| `accessibilityNeeds.dyslexia` | Concept blocks use shorter paragraphs + bold key terms |
| `expertiseDomains` | Skip remedial modules for known domains; enable cross-domain scenario blocks |
| `learningMotivations` | Exam → more checkpoint/practice blocks; curiosity → more scenario/enrichment |

### 4.3 Adaptive Path Engine

Instead of a static sequence, the path engine decides the **next best lesson** dynamically:

```
Input:  user_concept_state + learner_profile + module_graph + completion_state
Output: next_lesson_id (or "insert remedial module" / "skip to advanced")
```

**Rules evaluated in order:**
1. **Mastery gate** — if the next module requires concepts with `stability < threshold`, insert or surface a remedial module
2. **Skip gate** — if all concepts in a module have `retrievability > 0.9`, mark module as "test-out eligible" and let the learner take a checkpoint to skip
3. **Profile mode** — `focusMode=exam_prep` → prioritize practice/checkpoint blocks; `focusMode=deep_understanding` → prioritize concept/reflection blocks
4. **Pace adjustment** — if `inferredPace=slow` and the learner is behind schedule, offer a "catch-up route" (condensed lessons covering only prerequisites for upcoming modules)
5. **Re-engagement** — if `daysSinceLastActivity > 3`, surface a shortened "welcome back" lesson reviewing decayed concepts

### 4.4 Block Generation with AI

Extend `packages/ai/src/curriculum/generate.ts` to produce the full hierarchy instead of flat items:

```
generateCourse(goal, profile, existingConcepts)
  → returns { modules: [{ lessons: [{ blocks: [...] }] }] }
```

Each block includes:
- `blockType` — one of the seven types
- `conceptIds[]` — which concepts this block teaches/tests
- `contentChunkIds[]` — grounding chunks from ingested content
- `generatedContent` — AI-generated text/questions (Zod-validated `generateObject`)
- `bloomLevel` — Bloom's taxonomy level for this block

The AI prompt includes `getProfilePrompt(profile)` to adapt generation.

### 4.5 Engagement Layer

Map the guide's engagement loop to our existing systems:

| Engagement Element | Implementation |
|--------------------|----------------|
| **Skill-based progress** | Aggregate `user_concept_state.retrievability` per module's concept set → show as skill bar |
| **Milestones** | Module completion + mastery gates passed → milestone badges (tie to `gamification` tables) |
| **Real-time feedback** | Checkpoint/practice blocks use streaming AI feedback (existing SSE infrastructure) |
| **Variety rhythm** | Generation prompt enforces "no 2 consecutive blocks of same type" and "checkpoint every 3 blocks" |
| **Re-engagement triggers** | Cron job checks `daysSinceLastActivity`; pushes notification with a short catch-up lesson |

---

## 5. Implementation Plan

### Phase A — Schema & Data Layer (Week 1)

**New tables:**

```sql
-- Modules within a course (goal)
CREATE TABLE course_modules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id           UUID NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
    sequence_order    INT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,
    module_type       TEXT NOT NULL DEFAULT 'mandatory'
                          CHECK (module_type IN ('mandatory','remedial','advanced','enrichment')),
    concept_ids       UUID[] DEFAULT '{}',
    unlock_rule       JSONB,          -- { type: 'mastery_gate', conceptIds: [...], threshold: 0.8 }
    estimated_minutes INT,
    status            TEXT DEFAULT 'locked'
                          CHECK (status IN ('locked','available','in_progress','completed','skipped')),
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_course_modules_goal ON course_modules(goal_id, sequence_order);

-- Lessons within a module
CREATE TABLE course_lessons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id         UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    sequence_order    INT NOT NULL,
    title             TEXT NOT NULL,
    lesson_type       TEXT NOT NULL DEFAULT 'standard'
                          CHECK (lesson_type IN ('standard','workshop','lab','case_study','revision','capstone')),
    estimated_minutes INT,
    status            TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','in_progress','completed','skipped')),
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_course_lessons_module ON course_lessons(module_id, sequence_order);

-- Blocks within a lesson
CREATE TABLE lesson_blocks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    sequence_order      INT NOT NULL,
    block_type          TEXT NOT NULL
                            CHECK (block_type IN ('concept','worked_example','checkpoint','practice','reflection','scenario','mentor')),
    concept_ids         UUID[] DEFAULT '{}',
    content_chunk_ids   UUID[] DEFAULT '{}',
    bloom_level         TEXT CHECK (bloom_level IN ('remember','understand','apply','analyze','evaluate','create')),
    generated_content   JSONB NOT NULL DEFAULT '{}',   -- type-specific: { text, questions[], options, hints[] }
    interaction_log     JSONB DEFAULT '[]',             -- learner responses captured here
    status              TEXT DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','completed','skipped')),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lesson_blocks_lesson ON lesson_blocks(lesson_id, sequence_order);
```

**Changes to existing tables:**

```sql
-- learning_goals: add learning mode, replace method_preferences
ALTER TABLE learning_goals
  ADD COLUMN learning_mode TEXT DEFAULT 'understand_first'
    CHECK (learning_mode IN ('understand_first','remember_longer','apply_faster','deep_mastery','exam_prep','mentor_heavy')),
  ADD COLUMN schema_version INT DEFAULT 1;  -- 1 = flat curriculum_items, 2 = modular
```

**Type changes in `packages/shared/src/types.ts`:**
- Add `LearningMode` type (6 modes)
- Add `MethodWeights` type (8 evidence-based methods)
- Deprecate `MethodPreferences` (keep for v1 backward compat)
- Deprecate `FocusMode` (absorbed into `LearningMode`)

**Method weight resolver in `packages/ai/src/curriculum/method-defaults.ts`:**
- New `getMethodWeights(mode: LearningMode, profile: LearnerProfile): MethodWeights`
- Each mode has a base preset; profile dimensions adjust (e.g., ADHD bumps scaffolding)
- Replaces `getMethodDefaults()` for v2 courses

**Migration of existing data:**
- Existing `curriculum_items` stay as-is for backward compat
- New courses use the module/lesson/block hierarchy
- `schema_version=1` courses keep using `method_preferences`; `schema_version=2` uses `learning_mode`

### Phase B — Course Generation AI (Week 2)

1. **New function: `generateModularCourse()`** in `packages/ai/src/curriculum/generate.ts`
   - Input: goal metadata + learner profile + ingested content concepts + content chunks
   - Step 1: Generate module outline (4–8 modules) with concept mapping and module types
   - Step 2: For each module, generate lessons (2–5 per module) with lesson types adapted to profile
   - Step 3: For each lesson, generate blocks (3–8 per lesson) with variety rhythm enforced
   - All steps use `generateObject` with Zod schemas
   - Profile-aware: `getProfilePrompt(profile)` injected into each generation step

2. **Block content generators** — one per block type in `packages/ai/src/curriculum/blocks/`:
   - `concept.ts` — generates explanation grounded in content chunks
   - `checkpoint.ts` — generates 1–3 questions at appropriate Bloom level
   - `practice.ts` — generates exercises with solution and rubric
   - `reflection.ts` — generates prompts adapted to communication style
   - `scenario.ts` — generates branching decision tree (2–3 decision points)
   - `worked-example.ts` — generates step-by-step expert walkthrough
   - All capped by `inferredBloomCeiling` from learner profile

3. **Method-to-block mapping** — `getMethodWeights()` output drives block ratios:
   - High `retrievalPractice` → more `checkpoint` blocks, recall-before-reveal pattern
   - High `interleaving` → block ordering mixes related concepts instead of grouping
   - High `dualCoding` → `concept` blocks include Mermaid diagram / concept map generation
   - High `concreteExamples` → more `worked_example` and `scenario` blocks
   - High `elaboration` → more `mentor` blocks with "why/how/connect" prompts
   - High `scaffolding` → `practice` blocks start with hints, fade as mastery rises
   - High `guidedReflection` → `reflection` blocks after every module

4. **Profile-driven generation rules:**
   - `explanationDepth=concise` → max 2 concept blocks per lesson, more practice
   - `explanationDepth=thorough` → more concept + worked_example blocks
   - `accessibilityNeeds.adhd` → insert checkpoint after every 2 blocks; shorter concept blocks
   - `accessibilityNeeds.dyslexia` → concept blocks use shorter paragraphs + bold key terms
   - `inferredOptimalSessionMin` → cap lesson `estimated_minutes` to this value
   - `inferredBloomCeiling` → caps complexity of scenario/practice blocks

### Phase C — Path Engine (Week 3)

1. **`packages/ai/src/curriculum/path-engine.ts`** — pure function, no LLM calls:
   - `getNextLesson(goalId, userId)` → evaluates unlock rules, concept mastery, profile
   - `evaluateModuleStatus(moduleId, userId)` → checks mastery gates, returns `available | locked | skip_eligible`
   - `generateCatchUpRoute(goalId, userId)` → finds decayed concepts, creates shortened remedial lesson

2. **Integrate with concept graph:**
   - Module unlock rules reference `concept_edges` prerequisites
   - If prerequisite concept `retrievability < 0.7`, the module stays locked and a remedial module is suggested
   - If all module concepts have `retrievability > 0.9`, offer test-out checkpoint

3. **tRPC procedures** in `apps/web/src/server/trpc/routers/goals.ts`:
   - `getNextLesson` — returns the next lesson to study with its blocks
   - `completeBlock` — marks block complete, updates `user_concept_state`, evaluates module unlock
   - `skipModule` — after passing test-out checkpoint
   - `getCourseRoadmap` — returns full module/lesson tree with status + progress %

### Phase D — Learning Session Upgrade (Week 4)

1. **Refactor `/api/learn/session`** to be block-driven:
   - Instead of hardcoded teach→check→explain-back, iterate through lesson blocks
   - Each block type has its own SSE handler:
     - `concept` → stream explanation
     - `checkpoint` → stream question, wait for answer, stream feedback
     - `practice` → stream exercise, evaluate response, stream correction
     - `reflection` → stream prompt, capture response, AI evaluates
     - `scenario` → stream narrative, present choice, branch based on decision
     - `mentor` → open-ended Socratic exchange (existing mentor infrastructure)

2. **Block completion triggers:**
   - Update `user_concept_state` for concepts covered
   - Log to `review_log` for FSRS scheduling
   - Check if lesson is complete → check if module unlock rules are met

### Phase E — UI: Wizard Redesign, Roadmap & Lesson Player (Week 5–6)

1. **Wizard redesign** (`apps/web/src/components/course/course-setup-wizard.tsx`):
   - **Step 0–1**: keep as-is (purpose + familiarity)
   - **Step 2 — Topics**: group AI-suggested topics into module preview clusters with prereq arrows; show "~4 weeks at 15min/day" estimate
   - **Step 3 — Learning Mode**: replace focus cards + 4 method sliders with 6 mode cards (understand first, remember longer, apply faster, deep mastery, exam prep, mentor-heavy). Each card shows 2–3 bullets ("More visual explanations · Worked examples before practice · Gradual difficulty"). Collapsible "Customize" panel with 8 method sliders + session/schedule for power users
   - **Step 4 — Review & Generate**: add estimated structure preview ("~5 modules · ~18 lessons · ~65 blocks"). Animated generation stages ("Mapping concepts..." → "Building modules..." → "Creating lessons..." → "Ready!"). Redirect to roadmap view
   - **First-time user onboarding**: if no learner profile exists, inject 2–3 quick questions before the wizard (education stage, motivations, accessibility) to seed the profile and auto-select a good mode

2. **Course roadmap view** (`apps/web/src/components/course/course-roadmap.tsx`):
   - Visual module tree with current position indicator
   - Per-module: status badge, skill progress bar (from concept retrievability), estimated time
   - Locked modules show unlock requirement ("Master X, Y, Z first")
   - Skip-eligible modules show "Test out" button
   - **Mode adaptation card**: gentle notification when system detects a better mode ("You're acing checkpoints — try Deep mastery?")

3. **Lesson player** (`apps/web/src/components/course/lesson-player.tsx`):
   - Block-by-block progression with transition animations
   - Block type renders: concept card (with optional diagram), quiz card, practice workspace, reflection textarea, scenario chooser, mentor chat
   - Progress indicator showing blocks completed / total
   - "Next block" gated on completion (checkpoint must be answered, reflection must be submitted)
   - Scaffolding behavior: hint button visible on practice blocks, fades after 3 successful completions of similar difficulty

### Phase F — Engagement & Analytics (Week 6)

1. **Milestones**: module completion → badge in gamification system
2. **Streak integration**: completing a lesson counts toward daily streak
3. **Progress API**: `trpc.goals.getCourseProgress` returns skill-based progress per module
4. **Re-engagement**: scheduled job checks for inactive users, generates "welcome back" mini-lessons from decayed concepts
5. **Block-level analytics**: track time-per-block and completion rate for future optimization

---

## 6. What We Deliberately Defer

| Feature | Reason | When |
|---------|--------|------|
| Manual course builder UI | AI-generated first; manual editing adds complexity | Phase 3 |
| Social features (peer review, discussion) | Need user base | Phase 3 |
| A/B testing of lesson variants | Need analytics data first | Phase 3 |
| Content versioning | Low risk at current scale | Phase 3 |
| Choice nodes (learner picks specialization track) | Adds significant path complexity | Phase 2.5 |
| Timeline editor (fixed dates, rolling) | `targetDate` on goals is sufficient for now | Phase 2.5 |

---

## 7. Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| AI generates inconsistent module/lesson structure | Strong Zod schemas + validation pass after generation; retry on schema violations |
| Block generation is too slow (many LLM calls) | Generate module outline first, then lessons in parallel, then blocks in parallel per lesson |
| Mastery gates frustrate learners | Always offer a "catch-up route" when locked; never dead-end |
| Migration breaks existing courses | `schema_version` flag; v1 courses continue using flat `curriculum_items` |
| Over-personalization feels uncanny | Profile effects are subtle (block ratio, language level) not drastic; user can always override via settings |

---

## 8. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg lessons completed per course | ~3 (flat items) | 8+ (modular) |
| Session duration | ~6 min | 10–15 min (matching `inferredOptimalSessionMin`) |
| Concept retention at 7 days | unmeasured | >70% retrievability |
| Course completion rate | ~15% | 35%+ |
| Blocks with active interaction | 33% (teach/check/explain) | 60%+ (varied block types) |
