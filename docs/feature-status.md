# Feature Status — Modular Course System

> Last updated: March 14, 2026  
> Reference: [COURSE_IMPROVEMENT_PLAN.md](./COURSE_IMPROVEMENT_PLAN.md) · [modular-courses.md](./modular-courses.md)

---

## Summary

| Phase | Name | Status |
|---|---|---|
| A | Schema & Data Layer | ✅ Complete |
| B | Course Generation AI | ✅ Complete |
| C | Adaptive Path Engine | ✅ Complete |
| D | Learning Session Upgrade | ✅ Complete |
| E | UI: Wizard, Roadmap & Lesson Player | ✅ Complete |
| F | Engagement & Analytics | ✅ Complete |
| G | Smart Discovery Feed | ✅ Complete |

---

## Phase A — Schema & Data Layer ✅

| Item | Status |
|---|---|
| `course_modules`, `course_lessons`, `lesson_blocks` tables | ✅ Done |
| `learning_goals.learning_mode` + `schema_version` columns | ✅ Done |
| `LearningMode` / `MethodWeights` shared types | ✅ Done |
| `getMethodWeights(mode, profile)` resolver | ✅ Done |
| Drizzle migration `0005_hot_warstar.sql` | ✅ Done |
| CHECK constraints on `learning_mode` and `schema_version` | ✅ Done |
| RLS policies for all 3 new tables | ✅ Done |
| Migration `0006_rls_and_constraints.sql` | ✅ Done |

---

## Phase B — Course Generation AI ✅

| Item | Status |
|---|---|
| Zod schemas per block type (7 types) | ✅ Done |
| `generateBlockContent()` with retry on schema violation (up to 3 attempts) | ✅ Done |
| `generateModularCourse()` pipeline (parallel module→lesson→block generation) | ✅ Done |
| Profile-aware generation + Bloom ceiling enforcement | ✅ Done |
| Method-to-block mapping (`selectBlockTypes`) | ✅ Done |
| DALL-E 3 cover image | ✅ Done |
| Prompt injection guards on all user-controlled text | ✅ Done |

---

## Phase C — Adaptive Path Engine ✅

| Item | Status |
|---|---|
| `getNextLesson(goalId, userId)` | ✅ Done |
| `evaluateModuleStatus(moduleId, userId)` | ✅ Done |
| `isModuleSkipEligible(moduleId, userId)` | ✅ Done |
| `getCourseRoadmap(goalId, userId)` with concept skill + unlock requirements | ✅ Done |
| `generateCatchUpSuggestion(goalId, userId)` — identifies weak concepts for locked modules | ✅ Done |
| `getWelcomeBackSuggestion(userId)` — identifies decayed concepts for inactive users | ✅ Done |
| Module unlocking on lesson/block completion | ✅ Done |
| `completeBlock` → FSRS `user_concept_state` + `review_log` integration | ✅ Done |
| tRPC: `getNextLesson`, `getCourseRoadmap`, `getLessonBlocks`, `completeBlock`, `skipModule`, `getCourseProgress`, `getCatchUpSuggestion`, `getWelcomeBack` | ✅ Done |

---

## Phase D — Learning Session Upgrade ✅

| Item | Status |
|---|---|
| `POST /api/learn/session-v2` (block-driven SSE) | ✅ Done |
| All 7 block type actions (stream_concept, get_checkpoint, etc.) | ✅ Done |
| Full block→lesson→module→goal ownership chain | ✅ Done |
| Block completion triggers FSRS concept state update + review_log | ✅ Done |
| Block-level analytics (timeSpentMs, hintsUsed, correct) in `interaction_log` | ✅ Done |

---

## Phase E — UI: Wizard, Roadmap & Lesson Player ✅

| Item | Status |
|---|---|
| Wizard: 6 learning mode cards, adaptive per education stage | ✅ Done |
| Wizard: topic grouping into Foundations / Core / Advanced clusters | ✅ Done |
| Wizard: estimated structure preview (~N modules · ~N lessons · ~N blocks) | ✅ Done |
| Wizard: first-time user onboarding (education stage selection before wizard) | ✅ Done |
| Wizard: animated generation stages | ✅ Done |
| Roadmap: module cards with status, lessons, actions | ✅ Done |
| Roadmap: locked modules show specific concept unlock requirements with % bars | ✅ Done |
| Roadmap: per-module concept skill bar from retrievability | ✅ Done |
| Roadmap: mode adaptation suggestion card based on block type patterns | ✅ Done |
| Lesson player: all 7 block type renderers with error recovery | ✅ Done |
| Lesson player: transition animations between blocks (fade/slide) | ✅ Done |
| Lesson player: scaffold fading (fewer hints as session progresses) | ✅ Done |

---

## Phase F — Engagement & Analytics ✅

| Item | Status |
|---|---|
| Achievement keys for course milestones | ✅ Done |
| Module/course completion → badge awards (first_module_complete, first_course_complete, modules_5/10, blocks_50/100) | ✅ Done |
| Block completion → streak update + XP award | ✅ Done |
| `getCourseProgress` tRPC procedure | ✅ Done |
| Block-level timing data in `interaction_log` | ✅ Done |

---

## Smart Discovery Feed ✅

| Item | Status |
|---|---|
| `suggestion_dismissals` table + RLS policy | ✅ Done |
| AI personalized topic generation (`generatePersonalizedTopics`) | ✅ Done |
| Trending topics from goal aggregation | ✅ Done |
| Concept gap suggestions (prerequisite analysis) | ✅ Done |
| "Surprise me" random topic with AI hook | ✅ Done |
| Dismiss-and-replace flow with DB persistence | ✅ Done |
| `discovery` tRPC router (getSuggestions, dismiss, getRandomTopic) | ✅ Done |
| `DiscoveryFeed` + `SuggestionCard` components | ✅ Done |
| Static "Browse all categories" fallback (collapsible) | ✅ Done |
| Loading skeletons + error fallback | ✅ Done |
| Migration `0007_discovery_dismissals.sql` | ✅ Done |

---

## Explicitly Deferred (from plan §6)

| Feature | Planned For |
|---|---|
| Manual course builder UI | Phase 3 |
| Social features (peer review, discussion) | Phase 3 |
| A/B testing of lesson variants | Phase 3 |
| Content versioning | Phase 3 |
| Choice nodes (learner picks specialization track) | Phase 2.5 |
| Timeline editor (fixed dates, rolling schedule) | Phase 2.5 |

---

## Performance Optimizations (March 2026)

| Optimization | Status |
|---|---|
| 14 DB indexes + HNSW vector index (migration `0008`) | ✅ Done |
| N+1 query fixes (goals: getActive, getCourseProgress, updateConceptStateFromBlock, skipModule) | ✅ Done |
| 12+ sequential DB calls → Promise.all (review, user, export, analytics, gamification) | ✅ Done |
| Ownership check consolidation (session-v2, getLessonBlocks, completeBlock: 3-4 queries → 1 join) | ✅ Done |
| Upstash Redis caching layer (`cached()`, `invalidateCache()`, `invalidatePattern()`) | ✅ Done |
| Upstash rate limiting on all 7 API routes (with in-memory fallback) | ✅ Done |
| Embedding cache (Redis-backed, SHA256-keyed) | ✅ Done |
| `maxTokens` on all LLM calls (mentor, quiz, curriculum, discovery, explain-back) | ✅ Done |
| Mentor system prompt compressed (~40% fewer tokens) | ✅ Done |
| RAG topK reduced (6→4 scoped, 10→8 cross), chunk truncation, relevance filtering | ✅ Done |
| Concept extraction batch size 5→8, compressed prompt | ✅ Done |
| TanStack Query defaults: gcTime 5min, refetchOnWindowFocus off | ✅ Done |
| SSE artificial delay removed (session-v2) | ✅ Done |
| Connection pooling: max=1 in prod (serverless-optimized) | ✅ Done |
| Lazy AI imports in goals router (reduced cold start) | ✅ Done |
| SELECT * replaced with explicit columns (library.getById, review.getExamReadiness) | ✅ Done |

---

## Known Limitations

| Limitation | Mitigation |
|---|---|
| ~~In-memory rate limiting resets on deploy~~ | ✅ Migrated to Upstash Redis |
| ~~N+1 queries in `getCourseRoadmap`~~ | ✅ Fixed with batched queries |
| No transactional rollback in generation pipeline | Partial structures may persist on failure |
| Catch-up route is a suggestion (no auto-generated remedial lesson) | User can review concepts in FSRS review queue |
| Mode suggestion is heuristic (block type ratio), not ML-based | Sufficient for current scale; upgrade when analytics data exists |
| Scaffold fading uses session-local block count, not persistent mastery | Good proxy; could use `user_concept_state` directly later |
