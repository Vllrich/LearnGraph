# Course-generation teasers (Phase-1 waiting screen)

**Status:** Design · 2026-04-19
**Author:** Product + engineering
**Related:** [`modular-courses.md`](./modular-courses.md), commit `73644e9` (two-phase course generation)

## Problem

After the end-of-questionnaire flow submits to `POST /api/learn/start-v2`, users
wait **45–60 seconds** before the roadmap appears. Phase 1 makes two sequential
reasoning-model calls (module outline → Module 1 lessons) and each takes
20–30s. The current UX is a single spinner on the page, which reads as "stuck".

Two-phase generation (already shipped) removed the rest of the wait — modules
2..N and block content are generated in the background via `after()`. Phase 1
itself is the remaining hot spot.

## Goal

Turn the Phase-1 wait into something **engaging and on-topic** without growing
the wall-clock time or introducing a meaningful new failure surface. Users
should feel the system is actively preparing *their* course, not grinding
through a generic spinner.

Non-goal: shrinking Phase 1 itself. That's a separate follow-up (see
"Follow-ups" below) and should land after this work so we get compounding
improvements.

## High-level approach

Stream short **keyword + one-line teaser** cards to the client *in parallel*
with the Phase-1 generation, and rotate them on a full-width "curtain" screen
that replaces the current spinner.

Hybrid data source:

1. **0–2s:** Hand-authored generic cards (learning science, study tips) rotate
   immediately. Zero latency, always works.
2. **~2s onwards:** A lightweight streaming LLM call, fired from the client in
   parallel with `/api/learn/start-v2`, produces 6–8 course-specific cards and
   streams them in as they're produced. They fade in and start taking over the
   rotation.
3. **Failure fallback:** If the teaser call errors or produces nothing within
   8s, the generic set keeps rotating. The user sees no error, ever — the
   teasers are additive-only.

## Why not alternatives we considered

| Option | Why not (for now) |
| --- | --- |
| Reuse the module outline as it comes back from the main call | Cards only appear *halfway* through the wait; defeats the purpose. |
| Fully streamed "course taking shape" view over SSE | Biggest UX win but requires refactoring `/api/learn/start-v2` to SSE and re-architecting the start flow. ~3× the build cost of this proposal for a one-time screen. Revisit once this lands. |
| Interactive quick-win (micro-quiz during the wait) | Risks feeling like more questionnaire immediately after the questionnaire. Keep passive for now. |

## User experience

### Component: `<CourseGenerationCurtain />`

- Replaces the current Phase-1 spinner on the submission screen.
- Full-width card, centered vertically.
  - **Headline (static):** "Crafting your course…"
  - **Sub-line (time-driven, not fake %):** "Designing your modules…" (0–20s) →
    "Shaping your first lessons…" (20–40s) → "Almost ready…" (40s+).
  - **Teaser card:** keyword + 1-sentence blurb. Crossfades every 4s.
  - **Dots under the card:** show current position in the current card set.
    Non-interactive.
- Respects `prefers-reduced-motion` — no crossfade, instant swap.
- Uses `aria-live="polite"` on the card region so screen readers announce
  each new teaser.
- No tap-through, no back/forward controls. It's a passive wait.

### Teaser card shape

```ts
type TeaserCard = {
  keyword: string;     // 1–3 words, e.g. "Backpropagation"
  blurb: string;       // 1 sentence, ≤ 140 chars
  moduleHint?: string; // optional short phrase, e.g. "Module 3"
};
```

### Generic starter set

~12 hand-authored cards stored as a constant in
`apps/web/src/components/course/teaser-generic-cards.ts`. Topics cover
learning science, spaced repetition, active recall, Bloom's taxonomy, etc.
Examples:

> **Active recall** — Pulling information *out* of your head beats reading it in again. Your quizzes are built around this.
>
> **Spaced repetition** — We'll resurface concepts at the moments you're most likely to forget them.

These are shown from t=0 and keep rotating even after AI cards arrive, just
deprioritized.

## Architecture

### New client-side endpoint trigger

The client calls **two things in parallel** on questionnaire submit:

```
POST /api/learn/start-v2       (existing, unchanged)
POST /api/learn/teasers        (new, SSE)
```

The curtain renders as soon as either response opens. When `start-v2`
completes, the curtain fades out and we navigate to the roadmap as before.
Teaser stream is aborted if still open (AbortController).

### New endpoint: `POST /api/learn/teasers`

- **Input (JSON body):** `{ topic, goalType, currentLevel, educationStage }`
  — a subset of what `start-v2` already receives. Zod-validated.
- **Auth:** same Supabase session check as `start-v2`. Anonymous callers 401.
- **Rate limit:** separate Redis bucket keyed to the same user id. 10 calls /
  minute. Deliberately tight — no legitimate user needs more.
- **Output:** Server-sent events. One event per card:
  ```
  event: card
  data: {"keyword":"Backpropagation","blurb":"…","moduleHint":"Module 3"}
  ```
  Terminates with `event: done` when the LLM stream finishes, or `event: error`
  on failure.
- **No DB writes.** Teasers are ephemeral.

### AI module: `packages/ai/src/curriculum/generate-teasers.ts`

- Uses the same `structuredPrimaryModel` as the curriculum calls (`gpt-5-nano`
  with `reasoningEffort: "low"`; same family and settings as `start-v2`).
- Uses Vercel AI SDK's `streamObject` with a Zod schema of
  `{ cards: TeaserCard[] }`.
- Prompt is small and deterministic; ~200 tokens in, ~250 tokens out. At
  current `gpt-5-nano` pricing this is well under $0.001 / course.
- Exports `generateTeaserCardsStream(input): AsyncIterable<TeaserCard>`.

### Caching

**Explicitly out of scope for this release.** A per-`(topic, level, goalType)`
Redis cache is an obvious next step and will cut cost to near-zero on repeat
topics, but we're not introducing a caching strategy in this PR — the product
owner wants caching tackled as its own cross-cutting workstream.

## Error handling

- **Teaser call errors:** Logged with a correlation id (same
  `categorizeGenerationError` utility introduced in commit `73644e9`). No UI
  change — the curtain keeps rotating generic cards.
- **Teaser call takes too long:** 8s timeout from request start to first card.
  On timeout we abort the call and stay on generics. Slow networks never break
  the wait screen.
- **User aborts (closes tab):** SSE stream cleans itself up via
  `request.signal.aborted`.
- **Rate-limit hit:** Endpoint returns 429 and the client silently falls back
  to generics — no toast, no banner. This screen is not the place to surface
  rate-limit errors.

## Observability

- Log `teaser_request_started`, `teaser_first_card_latency_ms`,
  `teaser_total_cards`, `teaser_failed` (with reason) to our existing Langfuse
  setup — piggybacks on the wrapping already done for `start-v2`.
- No new Grafana dashboards needed; existing "LLM cost per course" metric will
  capture the marginal cost.

## Testing

- **Unit (`packages/ai`):**
  - `generateTeaserCardsStream` parses streamed object output correctly, emits
    cards in arrival order, terminates on close.
  - Schema validation rejects malformed LLM output.
- **Integration (`apps/web`):**
  - `/api/learn/teasers` returns 401 for anonymous, 429 over rate limit, SSE
    event sequence on happy path.
  - Aborting the client request closes the upstream LLM stream (no orphan
    tokens billed).
- **Component (`CourseGenerationCurtain`):**
  - Renders generic cards at t=0 without network.
  - Swaps in streamed cards as they arrive (mocked stream).
  - Falls back gracefully when the SSE source errors mid-stream.
  - Respects `prefers-reduced-motion` (no transition classes applied).
- **E2E:** one Playwright test that submits the questionnaire and asserts the
  curtain is visible with at least one card within 1s.

## Files touched

**New:**
- `apps/web/src/app/api/learn/teasers/route.ts`
- `apps/web/src/components/course/course-generation-curtain.tsx`
- `apps/web/src/components/course/teaser-card.tsx`
- `apps/web/src/components/course/teaser-generic-cards.ts`
- `packages/ai/src/curriculum/generate-teasers.ts`

**Modified:**
- Wherever the Phase-1 spinner currently renders — candidates:
  - `apps/web/src/components/course/course-setup-wizard.tsx` (questionnaire
    submit flow)
  - `apps/web/src/components/home/discovery-feed.tsx` (if "try a suggestion"
    also hits `start-v2`)
  Exact site to be confirmed at implementation time.
- `packages/ai/src/curriculum/index.ts` — export the new module.

## Out of scope / follow-ups

- **Shrink Phase 1.** Two concrete levers once this lands:
  1. Parallelize cover-image generation with Module 1 lesson generation.
  2. Synchronously generate only Module 1 Lesson 1 instead of all Module 1
     lessons — user reaches the roadmap in ~20–25s.
- **Redis cache for teasers.** Tackled as part of a broader caching
  workstream.
- **Fully streamed "course taking shape" view.** Bigger build, revisit
  post-launch.
- **Localization.** English only for now, matching the rest of the course
  content.

## Effort estimate

~1 day of focused work, including:
- Spec doc (this document, ~30 min)
- AI module + prompt (~2h)
- API route + rate limit wiring (~2h)
- Curtain component + card visuals + generic copy (~3h)
- Tests (~1h)
- Wiring into the existing submit flow (~30 min)

## Implementation gate

Per the brainstorming workflow, this doc needs explicit user approval before
any implementation skill is invoked.
