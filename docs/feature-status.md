# Feature Status — Modular Course System

> Last updated: March 14, 2026  
> Reference: [COURSE_IMPROVEMENT_PLAN.md](../COURSE_IMPROVEMENT_PLAN.md) · [docs/modular-courses.md](./modular-courses.md)

---

## Summary

| Phase | Name | Status |
|---|---|---|
| A | Schema & Data Layer | ✅ Complete |
| B | Course Generation AI | ✅ Complete |
| C | Adaptive Path Engine | ⚠️ Partial |
| D | Learning Session Upgrade | ⚠️ Partial |
| E | UI: Wizard, Roadmap & Lesson Player | ⚠️ Partial |
| F | Engagement & Analytics | ⚠️ Partial |

---

## Phase A — Schema & Data Layer ✅

| Item | Status | Notes |
|---|---|---|
| `course_modules` table | ✅ Done | `packages/db/src/schema/courses.ts` |
| `course_lessons` table | ✅ Done | Same file |
| `lesson_blocks` table | ✅ Done | Same file |
| `learning_goals.learning_mode` column | ✅ Done | Default `understand_first` |
| `learning_goals.schema_version` column | ✅ Done | `1` = flat, `2` = modular |
| `LearningMode` / `MethodWeights` types | ✅ Done | `packages/shared/src/types.ts` |
| Deprecate `MethodPreferences` / `FocusMode` | ✅ Done | Kept for V1 compat |
| `getMethodWeights(mode, profile)` resolver | ✅ Done | `packages/ai/src/curriculum/method-defaults.ts` |
| `getDefaultLearningMode(goalType, stage)` | ✅ Done | Same file |
| Drizzle migration | ✅ Done | `0005_hot_warstar.sql` |
| CHECK constraints on `learning_mode` / `schema_version` | ❌ Missing | No DB-level constraint; only validated in app logic |
| Unique constraint on `(goal_id, sequence_order)` | ❌ Missing | Low-risk; app always inserts sequentially |
| RLS policies for new tables | ❌ Missing | New tables have no RLS migration yet |

---

## Phase B — Course Generation AI ✅

| Item | Status | Notes |
|---|---|---|
| Zod schemas per block type (7 types) | ✅ Done | `packages/ai/src/curriculum/blocks/schemas.ts` |
| `generateBlockContent(input)` | ✅ Done | `packages/ai/src/curriculum/blocks/generate-block.ts` |
| `generateModularCourse()` pipeline | ✅ Done | `packages/ai/src/curriculum/generate-modular.ts` |
| Module outline → lessons → blocks (parallel) | ✅ Done | Steps 1–3 in pipeline |
| Persist structure to DB | ✅ Done | Step 4 in pipeline |
| Generate block content & persist | ✅ Done | Step 5 in pipeline |
| Profile-aware generation (persona prompt) | ✅ Done | Injected via `getProfilePrompt(profile)` |
| Bloom ceiling enforcement | ✅ Done | `capBloomLevel()` per block |
| Method-to-block mapping (weight → block type ratios) | ✅ Done | `selectBlockTypes(weights, count, bloomCeiling)` |
| DALL-E 3 cover image | ✅ Done | In `start-v2` route |
| Separate block generators per type (`concept.ts` etc.) | ❌ Not done | All block types consolidated in one `generate-block.ts`; plan called for one file per type — functionally equivalent |
| Retry on Zod schema violation | ❌ Missing | Falls back to `{}` content on error; no retry |
| Transactional rollback on partial failure | ❌ Missing | Partial structures can persist if generation fails mid-way |

---

## Phase C — Adaptive Path Engine ⚠️

| Item | Status | Notes |
|---|---|---|
| `getNextLesson(goalId, userId)` | ✅ Done | `path-engine.ts` |
| `evaluateModuleStatus(moduleId, userId)` | ✅ Done | Same file |
| `isModuleSkipEligible(moduleId, userId)` | ✅ Done | Same file |
| `getCourseRoadmap(goalId, userId)` | ✅ Done | Same file |
| Module unlocking on lesson completion | ✅ Done | `unlockDependentModules()` called after completeBlock |
| tRPC: `getNextLesson` | ✅ Done | `goals.ts` router |
| tRPC: `getCourseRoadmap` | ✅ Done | Same |
| tRPC: `getLessonBlocks` | ✅ Done | Same |
| tRPC: `completeBlock` | ✅ Done | Same |
| tRPC: `skipModule` | ✅ Done | Same |
| tRPC: `getCourseProgress` | ✅ Done | Same |
| `generateCatchUpRoute()` — condensed remedial lesson from decayed concepts | ❌ Missing | Plan §4.3 rule 4; not implemented |
| Pace adjustment ("catch-up route" when behind schedule) | ❌ Missing | Relates to `generateCatchUpRoute` |
| Re-engagement — "welcome back" lesson after 3+ days inactive | ❌ Missing | Plan §4.3 rule 5 |
| `completeBlock` updates `user_concept_state` / `review_log` | ❌ Missing | Block completion marks DB status only; FSRS scheduling not triggered |
| `completeBlock` checks module unlock after completion | ✅ Done | Calls `unlockDependentModules` |

---

## Phase D — Learning Session Upgrade ⚠️

| Item | Status | Notes |
|---|---|---|
| `POST /api/learn/session-v2` (block-driven SSE) | ✅ Done | `apps/web/src/app/api/learn/session-v2/route.ts` |
| `stream_concept` action | ✅ Done | |
| `stream_worked_example` action | ✅ Done | |
| `stream_mentor` action | ✅ Done | |
| `get_checkpoint` / `submit_checkpoint` actions | ✅ Done | |
| `stream_practice_feedback` action | ✅ Done | |
| `stream_reflection_prompt` / `submit_reflection` actions | ✅ Done | |
| `get_scenario` / `submit_scenario_choice` actions | ✅ Done | |
| Full block→lesson→module→goal ownership chain | ✅ Done | Fixed post-review |
| Rate limiting | ✅ Done | In-memory, 30/min — not distributed |
| `block_complete` — triggers `user_concept_state` update via FSRS | ❌ Missing | Session marks block status only; no FSRS integration on completion |
| `block_complete` — logs to `review_log` | ❌ Missing | Same; FSRS is not wired to block sessions |
| Scaffold fading — hint count decreases as mastery rises | ❌ Missing | Plan §5 Phase B, item 6; hint UI exists but density is static |
| Interleaving block ordering (mix related concepts) | ❌ Missing | Block order is fixed at generation time; no dynamic reordering |

---

## Phase E — UI: Wizard, Roadmap & Lesson Player ⚠️

| Item | Status | Notes |
|---|---|---|
| `POST /api/learn/start-v2` course creation endpoint | ✅ Done | `apps/web/src/app/api/learn/start-v2/route.ts` |
| Course setup wizard — learning mode step (6 cards) | ✅ Done | `course-setup-wizard.tsx` |
| Wizard — adaptive per education stage (elementary skip, HS simplify) | ✅ Done | `getVisibleModes()`, `shouldSkipModeStep()` |
| Wizard — session length + days/week selectors | ✅ Done | With stage-based defaults |
| Wizard — collapsible "Customize" panel | ✅ Done | Expanded by default for self-learner |
| Wizard — animated generation stages ("Mapping concepts..." etc.) | ✅ Done | `GENERATION_STAGES` array |
| Wizard — goal-type auto-mode mapping | ✅ Done | `GOAL_AUTO_MODE` in wizard + `method-defaults.ts` |
| Course roadmap page (`/course/[goalId]`) | ✅ Done | `apps/web/src/app/(app)/course/[goalId]/page.tsx` |
| Course roadmap component — module cards with status | ✅ Done | `course-roadmap.tsx` |
| Course roadmap — "Start" / "Continue" / "Test out" actions | ✅ Done | Same |
| Lesson player page (`/course/[goalId]/learn`) | ✅ Done | `apps/web/src/app/(app)/course/[goalId]/learn/page.tsx` |
| Lesson player — all 7 block type renderers | ✅ Done | `lesson-player.tsx` |
| Lesson player — error recovery for failed blocks | ✅ Done | Fixed post-review |
| Wizard — topic grouping into module preview clusters | ❌ Missing | Plan §3.2 Step 2; topics are shown as flat list with no module grouping or prereq arrows |
| Wizard — prerequisite arrows between topic groups | ❌ Missing | Same |
| Wizard — estimated structure preview ("~5 modules · ~18 lessons") | ❌ Missing | Only shown after generation; not before |
| Wizard — first-time user onboarding injection (education stage, motivations) | ❌ Missing | Plan §3.3; no lightweight pre-wizard onboarding for new users |
| Roadmap — per-module skill bar from concept retrievability | ❌ Missing | Plan §4.5; roadmap shows lesson count but no concept-level skill bar |
| Roadmap — locked modules show specific unlock requirement | ❌ Missing | Locked modules show lock icon but no "Master X, Y, Z" detail |
| Roadmap — mode adaptation card ("You're acing checkpoints — try Deep mastery?") | ❌ Missing | Plan §3.4; no behavior-based mode suggestion |
| Lesson player — transition animations between blocks | ❌ Missing | Blocks render without transition animation |
| Lesson player — dynamic hint fading (fade after 3 successes) | ❌ Missing | Hint count is static |

---

## Phase F — Engagement & Analytics ⚠️

| Item | Status | Notes |
|---|---|---|
| New achievement keys (`first_module_complete`, `first_course_complete`, etc.) | ✅ Done | `packages/shared/src/types.ts` |
| `getCourseProgress` tRPC procedure | ✅ Done | `goals.ts` |
| Module completion → gamification badge award | ❌ Missing | Keys defined but `completeBlock`/module completion does not call gamification |
| Daily streak — lesson completion counts toward streak | ❌ Missing | Streak system not integrated with V2 course sessions |
| Re-engagement cron — "welcome back" mini-lesson | ❌ Missing | Plan §5 Phase F item 4 |
| Block-level analytics (time-per-block, completion rate) | ❌ Missing | `interaction_log` JSONB exists but not written to with timing data |

---

## Explicitly Deferred (from plan §6)

These were intentionally left out of scope and are not bugs:

| Feature | Planned For |
|---|---|
| Manual course builder UI | Phase 3 |
| Social features (peer review, discussion) | Phase 3 |
| A/B testing of lesson variants | Phase 3 |
| Content versioning | Phase 3 |
| Choice nodes (learner picks specialization track) | Phase 2.5 |
| Timeline editor (fixed dates, rolling schedule) | Phase 2.5 |

---

## Critical Missing Items (prioritized)

These are missing from what was implemented and should be addressed soon:

1. **RLS policies for `course_modules`, `course_lessons`, `lesson_blocks`** — no row-level security migration created yet. Without this, Supabase client calls bypass user isolation at the DB layer.
2. **`completeBlock` → FSRS integration** — lessons complete without updating `user_concept_state` or `review_log`. The spaced repetition system is not connected to V2 courses.
3. **CHECK constraints on `learning_mode` and `schema_version`** — invalid values can be stored.
4. **`generateCatchUpRoute()`** — no remedial path when a learner is behind schedule; they see a "Module locked" state with no way forward except reviewing FSRS cards separately.
5. **Module unlock requirement detail in roadmap** — locked modules need to surface which concepts must be mastered; currently a generic lock icon.
6. **Gamification hook on module complete** — achievements/badges for V2 milestones are never awarded.
