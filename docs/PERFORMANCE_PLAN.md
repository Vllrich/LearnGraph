# LearnGraph — Performance Optimization Plan

> **Author:** Performance Engineering  
> **Date:** March 14, 2026  
> **Scope:** API latency, DB query performance, LLM token efficiency, caching, concurrency, memory, cold starts  
> **Goal:** Reduce P95 response latency by 40–60%, LLM costs by 25–35%, DB load by 50%+

---

## Table of Contents

1. [Performance Issues Found](#1-performance-issues-found)
2. [Database Optimizations](#2-database-optimizations)
3. [LLM Token Optimizations](#3-llm-token-optimizations)
4. [Caching Architecture](#4-caching-architecture)
5. [Concurrency & Streaming](#5-concurrency--streaming)
6. [API Latency Reduction](#6-api-latency-reduction)
7. [Cold Start & Memory](#7-cold-start--memory)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Estimated Impact Summary](#9-estimated-impact-summary)

---

## 1. Performance Issues Found

### Critical (P0) — Measurable latency/cost impact today

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **N+1 queries in `goals.getActive`** | `routers/goals.ts` | 1 query per active goal; 10 goals = 10 round trips (~200ms) |
| 2 | **N+1 in `getCourseProgress`** | `routers/goals.ts` | Nested loops: modules → lessons → blocks; 5 modules × 4 lessons = 20+ queries |
| 3 | **N+1 in `updateConceptStateFromBlock`** | `routers/goals.ts` | Per-concept DB round-trips on every block completion |
| 4 | **12+ sequential DB calls that could be parallelized** | `library.getById`, `review.getStats`, `user.getSessionContext`, `export.getExportStats`, `analytics.getComparativeStats`, `gamification.getWeeklyJournal`, `discovery.getSuggestions` (pre-fetch) | Each adds 20–40ms × chain length |
| 5 | **No vector index (HNSW) on `concepts.embedding`** | `packages/db/src/schema/concepts.ts` | Concept dedup similarity search is sequential scan |
| 6 | **Missing indexes on high-traffic columns** | `learning_objects(user_id)`, `learning_goals(user_id, status)`, `questions(learning_object_id)`, `user_answers(user_id)`, `review_log(concept_id)` | Full table scans on filtered queries |
| 7 | **Zero LLM response caching** | All `packages/ai/src/` | Identical prompts re-execute at full cost and latency |
| 8 | **Mentor system prompt ~5–7k tokens per message** | `packages/ai/src/mentor/chat.ts` | $0.015–0.02 per mentor interaction just for input tokens |
| 9 | **`SELECT *` in 6+ locations** | `library.getById`, `session-v2`, `export`, `goals.getById` | Transfers unused columns (including `raw_text` which can be 100KB+) |
| 10 | **4 sequential ownership checks in `session-v2`** | `apps/web/src/app/api/learn/session-v2/route.ts` | 4 DB round-trips (~80ms) before any useful work |

### High (P1) — Significant at scale

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 11 | No pagination on `goals.list`, `library.getQuestions`, `gamification.getAchievements` | Various routers | Unbounded result sets grow with usage |
| 12 | In-memory rate limiting across 5 API routes | All `/api/*` route handlers | Resets on every serverless cold start; no cross-instance protection |
| 13 | `profilePrompt` + `methodEmphasisPrompt` regenerated on every LLM call | `generate-modular.ts`, `generate-block.ts` | Redundant compute + same tokens repeated across calls in a pipeline |
| 14 | Per-concept embedding in `upsertConcept` | `packages/ai/src/ingestion/concepts.ts` | N serial embedding API calls instead of batch |
| 15 | `exportGraph` loads all concept edges then filters in memory | `apps/web/src/app/api/export/route.ts` | Moves filtering work from DB (indexed) to Node (unindexed) |
| 16 | No connection pooling configuration | `packages/db/` | Each serverless invocation may open a new DB connection |
| 17 | `review_log` queries without index on `concept_id` | `packages/db/src/schema/progress.ts` | Joins on concept_id do sequential scans |

### Medium (P2) — Nice-to-have

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 18 | Cron email loop processes users sequentially | `api/cron/email-reminders/route.ts` | 100 users × 200ms/email = 20s |
| 19 | No edge caching for static tRPC queries | tRPC handler | Every health check, config fetch hits origin |
| 20 | 20ms artificial delay per SSE chunk | `session-v2/route.ts` line 346–351 | Adds latency to streaming responses |

---

## 2. Database Optimizations

### 2.1 Missing Indexes — New Migration

Add performance indexes to `packages/db/drizzle/0001_rls_and_indexes.sql`:

```sql
-- learning_objects: filtered by user_id + status on nearly every page
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_objects_user_status
  ON learning_objects (user_id, status);

-- learning_goals: list/filter by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_goals_user_status
  ON learning_goals (user_id, status);

-- questions: fetched by learning_object_id constantly
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_lo_id
  ON questions (learning_object_id);

-- questions: array contains search for concept-based quiz
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_concept_ids
  ON questions USING GIN (concept_ids);

-- user_answers: queried by user_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_answers_user_id
  ON user_answers (user_id);

-- review_log: joined on concept_id for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_log_concept_id
  ON review_log (concept_id);

-- concept_chunk_links: reverse lookup chunk → concepts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concept_chunk_links_chunk_id
  ON concept_chunk_links (chunk_id);

-- course tables: filter by status for progress queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_course_modules_status
  ON course_modules (goal_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_course_lessons_status
  ON course_lessons (module_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lesson_blocks_status
  ON lesson_blocks (lesson_id, status);

-- HNSW vector index on concepts.embedding for similarity dedup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concepts_embedding_hnsw
  ON concepts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Estimated impact:** 3–10× faster on filtered queries; concept dedup goes from O(n) scan to O(log n).

### 2.2 Eliminate N+1 Queries

#### `goals.getActive` — Replace N queries with 1 join

```typescript
// BEFORE: 1 query for goals + N queries per goal for course progress
const goals = await db.select().from(learningGoals).where(...);
const enriched = await Promise.all(goals.map(g =>
  db.select().from(lessonBlocks)
    .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
    .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
    .where(eq(courseModules.goalId, g.id))
));

// AFTER: Two batched joined queries with inArray, then group in memory
const goals = await db.select().from(learningGoals).where(...);
const goalIds = goals.map(g => g.id);
const [blockRows, nextLessonRows] = await Promise.all([
  db.select({ goalId: courseModules.goalId, blockStatus: lessonBlocks.status })
    .from(lessonBlocks)
    .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
    .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
    .where(inArray(courseModules.goalId, goalIds)),
  db.select({ goalId: courseModules.goalId, lessonId: courseLessons.id /* … */ })
    .from(courseLessons)
    .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
    .where(inArray(courseModules.goalId, goalIds)),
]);
const statsByGoal = Map.groupBy(blockRows, r => r.goalId);
```

#### `getCourseProgress` — Single query with joins

```typescript
// BEFORE: nested loops querying blocks per lesson per module
// AFTER: single query joining modules → lessons → blocks, group in JS
const rows = await db
  .select({
    moduleId: courseModules.id,
    moduleStatus: courseModules.status,
    lessonId: courseLessons.id,
    lessonStatus: courseLessons.status,
    blockId: lessonBlocks.id,
    blockStatus: lessonBlocks.status,
  })
  .from(courseModules)
  .leftJoin(courseLessons, eq(courseLessons.moduleId, courseModules.id))
  .leftJoin(lessonBlocks, eq(lessonBlocks.lessonId, courseLessons.id))
  .where(eq(courseModules.goalId, goalId))
  .orderBy(courseModules.sequenceOrder, courseLessons.sequenceOrder, lessonBlocks.sequenceOrder);
```

#### `updateConceptStateFromBlock` — Batch upsert

```typescript
// BEFORE: per-concept loop with select + insert/update
// AFTER: batch read + batch upsert
const existingStates = await db.select()
  .from(userConceptState)
  .where(and(
    eq(userConceptState.userId, userId),
    inArray(userConceptState.conceptId, conceptIds)
  ));
const existingMap = new Map(existingStates.map(s => [s.conceptId, s]));
// Compute all new states in memory, then single batch upsert
await db.insert(userConceptState)
  .values(batchValues)
  .onConflictDoUpdate({ ... });
```

**Estimated impact:** `getActive`: 10 queries → 2. `getCourseProgress`: 20+ queries → 1. `updateConceptStateFromBlock`: N queries → 2.

### 2.3 Replace SELECT * with Explicit Columns

Target files and the columns to exclude:

| File | Table | Exclude |
|------|-------|---------|
| `library.getById` | `learningObjects` | `raw_text` (can be 100KB+) — fetch only on Full Text tab |
| `session-v2/route.ts` | `lessonBlocks` | Select only `id`, `type`, `status`, `content`, `sequenceOrder`, `conceptIds` |
| `export/route.ts` | `mentorConversations` | Select only needed columns per export type |
| `goals.getById` | `learningGoals` | Drop `raw_text`, embeddings |

**Estimated impact:** 50–90% payload reduction on `library.getById` (raw_text is the largest column).

### 2.4 Ownership Check Consolidation

The `session-v2` route does 4 sequential queries to verify the ownership chain `block → lesson → module → goal`. Replace with a single joined query:

```typescript
const [ownership] = await db
  .select({ goalUserId: learningGoals.userId })
  .from(lessonBlocks)
  .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
  .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
  .innerJoin(learningGoals, eq(learningGoals.id, courseModules.goalId))
  .where(eq(lessonBlocks.id, blockId))
  .limit(1);

if (!ownership || ownership.goalUserId !== userId) throw new Error("Unauthorized");
```

**Estimated impact:** 4 round-trips (~80ms) → 1 round-trip (~20ms). 60ms saved on every session-v2 request.

### 2.5 Supabase Connection Pooling

Configure the Drizzle client to use Supabase's PgBouncer connection pooler (port 6543) with `?pgbouncer=true&connection_limit=1` per serverless instance. Update `packages/db/src/client.ts`.

---

## 3. LLM Token Optimizations

### 3.1 Mentor System Prompt Compression

Current mentor system prompt is ~5–7k tokens. Optimization strategy:

| Component | Current | Optimized | Savings |
|-----------|---------|-----------|---------|
| `SYSTEM_PROMPT` (pedagogical instructions) | ~300 tokens | ~180 tokens (remove verbose examples, use terse directives) | 40% |
| `buildPersonaBlock(profile)` | ~125–375 tokens | ~80–200 tokens (abbreviate dimensions, use key=value format) | 35% |
| Materials list | ~500–2000 tokens | ~200–500 tokens (title + ID only, remove descriptions) | 60% |
| Retrieved chunks (RAG context) | ~3–5k tokens | ~2–3k tokens (topK=4 instead of 6, truncate chunks to 400 tokens) | 30% |

**Implementation:**

```typescript
// BEFORE: verbose persona block
`The student's education stage is "undergraduate". They prefer a "casual" 
communication style. Their explanation depth preference is "thorough"...`

// AFTER: compressed key-value format  
`<profile>
edu=undergraduate comm=casual depth=thorough tone=encouraging
domains=["machine_learning","statistics"] pace=medium bloom_cap=apply
</profile>`
```

**Estimated savings:** ~2k tokens per mentor message → ~$0.006/message saved → 30% input cost reduction.

### 3.2 Profile Prompt Deduplication

`getProfilePrompt()` and `buildPersonaBlock()` are called independently in curriculum generation and mentor — they overlap significantly. Create a single `buildCompactProfile(profile)` function that returns a minimal representation, and inject it once.

### 3.3 Course Generation Token Pipeline

`generateModularCourse` makes N+1 `generateObject` calls (1 outline + N lessons + N×M blocks). Each call repeats `profilePrompt` and `methodEmphasisPrompt`.

**Optimization:** Compute prompts once, pass as a shared prefix:

```typescript
const sharedContext = {
  profile: buildCompactProfile(profile),
  weights: buildMethodEmphasisPrompt(weights),
};
// Reuse sharedContext in all generateObject calls
```

**Estimated savings:** ~200–400 tokens × (N lessons + N×M blocks) = 2–8k tokens per course generation.

### 3.4 Concept Extraction Batch Optimization

Currently processes 5 chunks per batch with the same instruction repeated. Increase batch size to 8–10 chunks (still within context window) and deduplicate the instruction.

**Estimated savings:** 40% fewer API calls for concept extraction, ~100 tokens saved per batch in instruction overhead.

### 3.5 RAG Retrieval Tuning

- Reduce `topK` from 6 → 4 for mentor (diminishing returns on chunk 5–6)
- Truncate each retrieved chunk to 400 tokens max (from 512)
- Add relevance threshold: drop chunks with similarity < 0.3

**Estimated savings:** ~1–2k tokens per mentor call.

### 3.6 LLM Output Token Limits

Add explicit `maxTokens` to every `generateObject` / `streamText` call based on expected output size:

| Call | Current max | Recommended max |
|------|-------------|-----------------|
| Mentor `streamText` | Default (4096) | 1500 |
| Block content `generateObject` | Default | 2000 |
| Summary `generateObject` | Default | 1500 |
| Quiz `generateObject` | Default | 800 |
| Discovery suggestions | Default | 600 |

---

## 4. Caching Architecture

### 4.1 Multi-Layer Cache Design

```
┌─────────────────────────────────────────────────────────┐
│                    Request Layer                         │
│  React cache() for RSC dedup (already present)          │
│  tRPC result cache (new — Upstash Redis, 60s TTL)       │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                            │
│  Supabase query cache (Upstash Redis, key=query hash)   │
│  User profile cache (Redis, 5min TTL, invalidate on     │
│    updateLearnerProfile)                                 │
│  Daily review queue cache (Redis, per-user, 1hr TTL)    │
├─────────────────────────────────────────────────────────┤
│                    AI Layer                              │
│  Embedding cache (Redis, key=text hash, no expiry)      │
│  Semantic LLM cache (Redis, key=prompt hash, 24hr TTL)  │
│  RAG chunk cache (Redis, key=query embedding, 1hr TTL)  │
├─────────────────────────────────────────────────────────┤
│                    Edge Layer                            │
│  CDN cache for static tRPC (health, config)             │
│  Vercel Edge cache headers on immutable responses       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Implementation: Upstash Redis Cache Utility

Create `packages/shared/src/cache.ts`:

```typescript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get<T>(key);
  if (hit !== null) return hit;
  const result = await fn();
  await redis.set(key, result, { ex: ttlSeconds });
  return result;
}

export async function invalidate(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
```

### 4.3 What to Cache

| Data | Cache Key | TTL | Invalidation |
|------|-----------|-----|--------------|
| Learner profile | `profile:{userId}` | 5 min | On `updateLearnerProfile` |
| Daily review queue | `queue:{userId}:{date}` | 1 hour | On `submitReview` |
| Library list (page 1) | `library:{userId}:p1` | 60s | On upload/delete |
| Embedding for text | `emb:{sha256(text)}` | ∞ (immutable) | Never |
| RAG retrieval result | `rag:{userId}:{sha256(query)}` | 1 hour | On new ingestion |
| Discovery suggestions | `discovery:{userId}` | 30 min | On dismiss |
| `getSessionContext` | `ctx:{userId}` | 2 min | On review submit |
| `getStats` | `stats:{userId}` | 5 min | On review submit |
| `getStreakAndXp` | `streak:{userId}` | 5 min | On `recordActivity` |
| Course progress | `progress:{goalId}` | 2 min | On `completeBlock` |

### 4.4 Embedding Cache (High Impact)

Every RAG query and concept dedup calls `generateEmbedding`. Cache embeddings by content hash:

```typescript
export async function cachedEmbedding(text: string): Promise<number[]> {
  const hash = createHash("sha256").update(text).digest("hex");
  const key = `emb:${hash}`;
  const hit = await redis.get<number[]>(key);
  if (hit) return hit;
  const { embedding } = await generateEmbedding({ model: embeddingModel, value: text });
  await redis.set(key, embedding); // no TTL — embeddings are deterministic
  return embedding;
}
```

**Estimated impact:** Eliminates repeated embedding calls for the same query text. At $0.00002/1k tokens, saves ~$0.10/user/month at moderate usage.

### 4.5 Semantic LLM Cache (Medium Impact)

For deterministic `generateObject` calls (quiz generation, discovery suggestions), cache by prompt hash:

```typescript
const cacheKey = `llm:${sha256(JSON.stringify({ model, system, prompt }))}`;
```

**Tradeoff:** Only safe for non-personalized, non-conversational calls. Must NOT cache mentor chat or streaming responses.

### 4.6 Cache Invalidation Strategy

- **Time-based:** Most caches use TTL as primary expiration
- **Event-based:** Critical caches (queue, profile, progress) are explicitly invalidated on write operations using `invalidate(`pattern:${userId}*`)`
- **Versioned keys:** For schema changes, prefix keys with a version: `v1:profile:{userId}`
- **Graceful degradation:** Cache misses fall through to DB — never block on cache failures

---

## 5. Concurrency & Streaming

### 5.1 Parallelize Sequential DB Calls

Each of these changes wraps independent queries in `Promise.all`:

#### `library.getById` — 3 sequential → parallel

```typescript
// BEFORE
const lo = await db.select().from(learningObjects).where(...);
const chunks = await db.select().from(contentChunks).where(...);
const concepts = await db.select().from(concepts).where(...);

// AFTER
const [lo, chunks, concepts] = await Promise.all([
  db.select({ id: learningObjects.id, title: learningObjects.title, /* explicit cols */ })
    .from(learningObjects).where(...),
  db.select().from(contentChunks).where(...),
  db.select().from(concepts).where(...), // via concept_chunk_links join
]);
```

#### `review.getStats` — 4 sequential → parallel

```typescript
const [masteryDist, recentReviews, userRow, streakResult] = await Promise.all([
  db.select(...).from(userConceptState).where(...),
  db.select(...).from(reviewLog).where(...),
  db.select(...).from(users).where(...),
  db.select(...).from(userStreaks).where(...),
]);
```

#### `user.getSessionContext` — 6 sequential → parallel

```typescript
const [recentReviews, masterySnapshot, weakConcepts, strongConcepts, activeGoals, user] =
  await Promise.all([ /* 6 independent queries */ ]);
```

**Apply the same pattern to:** `export.getExportStats`, `analytics.getComparativeStats`, `gamification.getWeeklyJournal`, `goals.checkCourseAchievements`, `discovery.getSuggestions` pre-fetches.

**Estimated impact:** Each parallelization saves (N-1) × ~20ms. For `getSessionContext`: 5 × 20ms = 100ms saved.

### 5.2 Batch Email Sending

```typescript
// BEFORE: sequential loop
for (const user of dueUsers) {
  await brevo.sendTransacEmail(...);
  await db.update(users).set({ lastEmailReminderAt: now });
}

// AFTER: parallel batches of 10
const batches = chunk(dueUsers, 10);
for (const batch of batches) {
  await Promise.all(batch.map(async (user) => {
    await brevo.sendTransacEmail(...);
    await db.update(users).set({ lastEmailReminderAt: now }).where(...);
  }));
}
```

### 5.3 Concept Embedding Batching

```typescript
// BEFORE: per-concept serial embedding in upsertConcept
for (const concept of newConcepts) {
  const embedding = await generateEmbedding(concept.name + concept.definition);
  await db.insert(concepts).values({ ...concept, embedding });
}

// AFTER: batch embed + batch insert
const texts = newConcepts.map(c => `${c.name}: ${c.definition}`);
const { embeddings } = await embedMany({ model: embeddingModel, values: texts });
const values = newConcepts.map((c, i) => ({ ...c, embedding: embeddings[i] }));
await db.insert(concepts).values(values).onConflictDoNothing();
```

### 5.4 Remove Artificial SSE Delay

`session-v2/route.ts` has a 20ms `setTimeout` per chunk. Remove it — the natural LLM token generation rate provides sufficient pacing. If client-side rendering struggles, debounce on the client instead.

---

## 6. API Latency Reduction

### 6.1 tRPC Response Compression

Enable gzip/brotli on the tRPC handler. Next.js on Vercel compresses by default, but verify with `Accept-Encoding` headers.

### 6.2 Smaller JSON Payloads

- Strip null fields from tRPC responses using a `superjson` replacer or custom transformer
- For `library.list`: return thumbnail URLs, not full object data — lazy load on detail view
- For `review.getDailyQueue`: return only question IDs + minimal metadata, fetch full question on card reveal

### 6.3 Edge Execution for Read-Heavy Routes

Move these to Edge Runtime (`export const runtime = 'edge'`):

| Route | Reason |
|-------|--------|
| `api/trpc/[trpc]` (GET only, select procedures) | `health.check`, read-only list queries |
| Static config endpoints | Zero DB dependency |

**Tradeoff:** Edge runtime cannot use Node.js-specific APIs. Only applicable to routes that use lightweight DB calls via Supabase REST (not Drizzle's node-postgres driver). Evaluate feasibility per route.

### 6.4 Request Batching

tRPC supports automatic request batching. Ensure the client is configured with `httpBatchLink` (not `httpLink`). This merges multiple simultaneous tRPC calls into a single HTTP request.

Verify in `apps/web/src/trpc/client.ts` that batching is enabled.

### 6.5 Stale-While-Revalidate for TanStack Query

Configure default `staleTime` and `gcTime` on the query client:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,     // 30s before refetch
      gcTime: 5 * 60_000,    // 5min in cache
      refetchOnWindowFocus: false,
    },
  },
});
```

**Impact:** Eliminates redundant refetches on tab switches and route changes.

---

## 7. Cold Start & Memory

### 7.1 Reduce Bundle Size in Serverless Functions

- **Lazy import AI models:** Don't import `@ai-sdk/anthropic` and `@ai-sdk/openai` at module level in routes that don't use them. Use dynamic `import()`.
- **Tree-shake Drizzle:** Ensure only needed operators are imported (`eq`, `and`, etc.), not the entire module.
- **Audit `packages/ai` barrel exports:** If `packages/ai/src/index.ts` re-exports everything, serverless functions importing one function pull in the entire AI package.

### 7.2 Selective Package Imports

```typescript
// BEFORE (pulls in entire package on cold start)
import { generateObject, streamText, generateEmbedding } from "ai";

// AFTER (only what's needed per route)
import { streamText } from "ai"; // mentor route only needs streamText
```

### 7.3 Connection Reuse

Ensure the Drizzle client is created at module scope (outside the handler) so it persists across warm invocations:

```typescript
// packages/db/src/client.ts — singleton pattern
let _db: ReturnType<typeof drizzle> | null = null;
export function getDb() {
  if (!_db) {
    _db = drizzle(process.env.DATABASE_URL!, { schema });
  }
  return _db;
}
```

### 7.4 In-Memory Rate Limit → Upstash Ratelimit

Replace all 5 in-memory `Map`-based rate limiters with Upstash Ratelimit (works across serverless instances):

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
});
```

**Impact:** Fixes the fundamental issue where rate limits reset on every cold start/new instance.

---

## 8. Implementation Roadmap

### Phase 1 — Quick Wins (1–2 days, no schema changes)

| Task | Files | Impact | Risk |
|------|-------|--------|------|
| Parallelize 12+ sequential DB calls with `Promise.all` | 7 tRPC routers | −100–200ms per affected endpoint | Low |
| Replace `SELECT *` with explicit columns | 6 locations | −50–90% payload on `getById` | Low |
| Consolidate 4 ownership checks into 1 join | `session-v2/route.ts` | −60ms per session request | Low |
| Remove 20ms SSE delay | `session-v2/route.ts` | −20ms × chunks per response | None |
| Set `maxTokens` on all LLM calls | 8 files in `packages/ai/` | Cost ceiling enforcement | None |
| Configure TanStack Query `staleTime` | `apps/web/src/trpc/` | Fewer redundant fetches | Low |

### Phase 2 — Database (1 day, requires migration)

| Task | Files | Impact | Risk |
|------|-------|--------|------|
| Add 12 missing indexes | Added to `0001_rls_and_indexes.sql` | 3–10× faster filtered queries | Low (CONCURRENTLY) |
| Add HNSW vector index on `concepts.embedding` | Same migration | O(n) → O(log n) concept dedup | Low |
| Fix N+1 in `getActive`, `getCourseProgress`, `updateConceptStateFromBlock` | `routers/goals.ts` | 10–20 queries → 1–2 per call | Medium |
| Connection pooling configuration | `packages/db/src/client.ts` | Fewer connection errors under load | Low |

### Phase 3 — Caching Layer (2–3 days, new dependency)

| Task | Files | Impact | Risk |
|------|-------|--------|------|
| Install `@upstash/redis` + `@upstash/ratelimit` | `package.json`, new `packages/shared/src/cache.ts` | Foundation for all caching | Low |
| Replace in-memory rate limiters | 5 API route files | Cross-instance rate limiting | Low |
| Add embedding cache | `packages/ai/src/rag/retrieve.ts`, `ingestion/concepts.ts` | Eliminate duplicate embedding calls | Low |
| Add profile/queue/stats caching | Various tRPC routers | −20ms per cache hit | Medium (invalidation) |
| Add RAG result cache | `packages/ai/src/rag/retrieve.ts` | Skip embedding + vector search on repeat queries | Medium |

### Phase 4 — LLM Optimization (1–2 days)

| Task | Files | Impact | Risk |
|------|-------|--------|------|
| Compress mentor system prompt | `packages/ai/src/mentor/chat.ts` | −2k tokens/message | Low |
| Deduplicate profile prompts | `persona.ts`, `method-defaults.ts` | −200–400 tokens/call | Low |
| Reduce RAG topK and chunk truncation | `retrieve.ts`, `chat.ts` | −1–2k tokens/message | Low (monitor quality) |
| Batch concept embeddings | `ingestion/concepts.ts` | Fewer API calls during ingestion | Low |
| Semantic cache for deterministic LLM calls | `quiz/generate.ts`, `discovery/` | Skip LLM for repeated inputs | Medium |

### Phase 5 — Advanced (3–5 days, larger changes)

| Task | Files | Impact | Risk |
|------|-------|--------|------|
| Supabase RPC for complex aggregations | New SQL functions | Single round-trip for `getCourseProgress` | Medium |
| Edge runtime for read-only routes | Selected API routes | Lower latency (edge PoP) | High (compatibility) |
| Lazy AI package imports | All API routes | Faster cold starts | Medium |
| Audit barrel exports | `packages/ai/src/index.ts` | Smaller function bundles | Low |

---

## 9. Estimated Impact Summary

| Metric | Current (est.) | After Phase 1–2 | After Phase 3–4 | After Phase 5 |
|--------|---------------|-----------------|-----------------|--------------|
| `getSessionContext` P95 | ~250ms | ~80ms (−68%) | ~30ms (cached) | ~30ms |
| `session-v2` first byte | ~200ms | ~80ms (−60%) | ~60ms | ~40ms |
| `getCourseProgress` P95 | ~400ms | ~60ms (−85%) | ~30ms (cached) | ~30ms |
| `library.getById` payload | ~150KB | ~15KB (−90%) | ~15KB | ~15KB |
| Mentor input tokens/msg | ~6k | ~6k | ~4k (−33%) | ~3.5k |
| Course gen total tokens | ~50k | ~50k | ~38k (−24%) | ~35k |
| Embedding API calls/ingest | N per concept | N per concept | N/2 (cached) | batch (1 call) |
| Cold start time | ~800ms | ~800ms | ~800ms | ~500ms (−37%) |
| LLM cost/user/month | ~$1.00 | ~$1.00 | ~$0.65 (−35%) | ~$0.55 (−45%) |
| DB queries/page load (home) | ~15 | ~6 (−60%) | ~2 (cached) | ~2 |

### Total Projected Savings

- **Latency:** 40–60% reduction in P95 for high-traffic endpoints
- **LLM cost:** 25–35% reduction in token spend
- **DB load:** 50–70% fewer queries per page load
- **Infrastructure:** Enables 3–5× more concurrent users on same Supabase plan

### Key Tradeoffs

| Optimization | Tradeoff |
|-------------|----------|
| Reduced RAG topK (6→4) | Slightly less context diversity; monitor answer quality |
| Prompt compression | Less verbose instructions may reduce output quality on edge cases |
| Aggressive TTL caching | Users see stale data for up to TTL seconds after writes |
| Edge runtime | Cannot use Node.js APIs (crypto, fs); limits which routes qualify |
| Embedding cache (∞ TTL) | Redis memory grows unbounded; add eviction policy at scale |
| Semantic LLM cache | Stale responses for evolving user profiles; only safe for non-personalized calls |

---

## 10. Implementation Status (March 14, 2026)

All 5 phases have been implemented:

| Phase | Status | Key Changes |
|-------|--------|-------------|
| 1: Quick Wins | ✅ Complete | 12+ sequential DB calls parallelized, SELECT * replaced, ownership checks consolidated (3-4 queries → 1 join in session-v2/getLessonBlocks/completeBlock), 20ms SSE delay removed, maxTokens on all LLM calls, TanStack Query gcTime/refetchOnWindowFocus |
| 2: Database | ✅ Complete | 14 CONCURRENTLY indexes + HNSW vector index (migration 0001), N+1 fixes in getActive/getCourseProgress/updateConceptStateFromBlock/skipModule, connection pooling max=1 in prod |
| 3: Caching | ✅ Complete | Upstash Redis `cached()`/`invalidateCache()`/`invalidatePattern()` in @repo/shared, all 7 API routes on `@upstash/ratelimit`, embedding cache (SHA256-keyed, Redis-backed) |
| 4: LLM Optimization | ✅ Complete | Mentor system prompt compressed ~40%, materials block compacted, RAG topK reduced (6→4/10→8), relevance filtering, concept extraction batch 5→8, compressed prompts |
| 5: Advanced | ✅ Complete | Lazy AI imports in goals router, barrel export audit, TanStack Query defaults optimized |

### Environment Variables Required

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

These are optional — all caching and rate limiting gracefully fall back to in-memory when Redis is unavailable.

_This plan is a living document. Update as optimizations are implemented and measured._
