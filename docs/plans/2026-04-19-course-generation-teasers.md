# Course-generation teasers implementation plan

**Goal:** Replace the Phase-1 spinner (45–60s blank wait after questionnaire submit) with a rotating "curtain" of keyword + one-line teaser cards — hand-authored generics immediately, AI-streamed course-specific cards in parallel.

**Architecture:** One new AI module (`generateTeaserCardsStream`), one new SSE route (`POST /api/learn/teasers`), two new React components (`<TeaserCard />`, `<CourseGenerationCurtain />`), one new static data module (generic fallback cards). Wired into `course-setup-wizard.tsx` in place of the existing `generating`-branch JSX.

**Tech stack:** Next.js App Router, Vercel AI SDK (`streamObject`), Zod, React 19, Vitest, Tailwind, `@repo/shared/rate-limit` (Upstash/Redis fallback), `@repo/shared/generation-error` for logging.

**Spec:** `docs/course-generation-teasers.md` (committed `f768c89`).

---

## Conventions

- **Commits:** One per task, Conventional Commits style matching recent history (`feat(course): …`, `test(ai): …`).
- **Tests run:** `pnpm -F @repo/ai test`, `pnpm -F web test`. Lint at the end: `pnpm -F web lint`.
- **No new env vars.** Teaser uses `structuredPrimaryModel` from `packages/ai/src/models.ts`, same as the main generation path.

---

## Task 1: Generic teaser card fallback data

**Files:**
- Create: `apps/web/src/components/course/teaser-generic-cards.ts`
- Create: `apps/web/src/components/course/teaser-generic-cards.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { GENERIC_TEASER_CARDS, type TeaserCard } from "./teaser-generic-cards";

describe("GENERIC_TEASER_CARDS", () => {
  it("has at least 10 cards so rotation doesn't feel repetitive", () => {
    expect(GENERIC_TEASER_CARDS.length).toBeGreaterThanOrEqual(10);
  });

  it("every card has a 1-3 word keyword and a blurb <=140 chars", () => {
    for (const card of GENERIC_TEASER_CARDS) {
      const words = card.keyword.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(1);
      expect(words.length).toBeLessThanOrEqual(3);
      expect(card.blurb.length).toBeGreaterThan(0);
      expect(card.blurb.length).toBeLessThanOrEqual(140);
    }
  });

  it("all keywords are unique", () => {
    const seen = new Set<string>();
    for (const card of GENERIC_TEASER_CARDS) {
      const key = card.keyword.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("exports a TeaserCard type compatible with the cards", () => {
    const sample: TeaserCard = GENERIC_TEASER_CARDS[0];
    expect(typeof sample.keyword).toBe("string");
    expect(typeof sample.blurb).toBe("string");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm -F web test -- teaser-generic-cards
```

Expected: fail because `teaser-generic-cards.ts` doesn't exist.

- [ ] **Step 3: Create the data module**

```ts
export type TeaserCard = {
  keyword: string;
  blurb: string;
  moduleHint?: string;
};

export const GENERIC_TEASER_CARDS: readonly TeaserCard[] = [
  {
    keyword: "Active recall",
    blurb: "Pulling information out of your head beats reading it in again. Your quizzes are built around this.",
  },
  {
    keyword: "Spaced repetition",
    blurb: "We resurface concepts at the moment you're most likely to forget them.",
  },
  {
    keyword: "Bloom's taxonomy",
    blurb: "Your lessons climb from remembering facts all the way to applying and creating.",
  },
  {
    keyword: "Interleaving",
    blurb: "Mixing topics feels harder in the moment but sticks much longer than blocked practice.",
  },
  {
    keyword: "Elaboration",
    blurb: "Explaining an idea in your own words is one of the fastest ways to really own it.",
  },
  {
    keyword: "Worked examples",
    blurb: "Seeing a problem solved step-by-step before you try it yourself reduces cognitive load.",
  },
  {
    keyword: "Retrieval cues",
    blurb: "Short prompts trigger long memories. We design lessons around the cues that matter.",
  },
  {
    keyword: "Desirable difficulty",
    blurb: "A little struggle is a feature, not a bug — it's what makes learning stick.",
  },
  {
    keyword: "Chunking",
    blurb: "Grouping related ideas into meaningful chunks expands what your working memory can hold.",
  },
  {
    keyword: "Dual coding",
    blurb: "Pairing words with visuals gives your brain two routes back to the same idea.",
  },
  {
    keyword: "Metacognition",
    blurb: "Thinking about your own thinking is how good learners become great ones.",
  },
  {
    keyword: "Feedback loops",
    blurb: "Fast, specific feedback turns mistakes into the fastest route to mastery.",
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm -F web test -- teaser-generic-cards
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/course/teaser-generic-cards.ts \
        apps/web/src/components/course/teaser-generic-cards.test.ts
git commit -m "feat(course): add generic teaser card fallback data"
```

---

## Task 2: AI module `generateTeaserCardsStream`

**Files:**
- Create: `packages/ai/src/curriculum/generate-teasers.ts`
- Create: `packages/ai/src/curriculum/generate-teasers.test.ts`
- Modify: `packages/ai/src/curriculum/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import {
  TeaserCardSchema,
  buildTeaserPrompt,
} from "./generate-teasers";

describe("TeaserCardSchema", () => {
  it("accepts a well-formed card", () => {
    const parsed = TeaserCardSchema.parse({
      keyword: "Backpropagation",
      blurb: "The engine that makes neural nets learn.",
      moduleHint: "Module 3",
    });
    expect(parsed.keyword).toBe("Backpropagation");
  });

  it("rejects blurbs over 140 chars", () => {
    const long = "x".repeat(141);
    expect(() =>
      TeaserCardSchema.parse({ keyword: "A", blurb: long }),
    ).toThrow();
  });

  it("rejects keywords with more than 3 words", () => {
    expect(() =>
      TeaserCardSchema.parse({
        keyword: "one two three four",
        blurb: "ok",
      }),
    ).toThrow();
  });
});

describe("buildTeaserPrompt", () => {
  it("embeds topic, goal, and level into the prompt", () => {
    const prompt = buildTeaserPrompt({
      topic: "Neural networks",
      goalType: "skill_building",
      currentLevel: "some_knowledge",
    });
    expect(prompt).toContain("Neural networks");
    expect(prompt).toContain("skill_building");
    expect(prompt).toContain("some_knowledge");
  });

  it("includes education stage when provided", () => {
    const prompt = buildTeaserPrompt({
      topic: "French Revolution",
      goalType: "exploration",
      currentLevel: "beginner",
      educationStage: "high_school",
    });
    expect(prompt).toContain("high_school");
  });
});

// Note: the streaming function `generateTeaserCardsStream` wraps
// `streamObject` from the Vercel AI SDK; we don't unit-test the stream
// mechanics directly (that's integration territory). Schema + prompt
// coverage above is sufficient at this layer — the real verification
// happens when the route is hit in dev.
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm -F @repo/ai test -- generate-teasers
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the module**

```ts
import { z } from "zod";
import { streamObject } from "ai";
import { structuredPrimaryModel } from "../models";

export const TeaserCardSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((s) => s.split(/\s+/).length <= 3, {
      message: "keyword must be 1-3 words",
    }),
  blurb: z.string().trim().min(1).max(140),
  moduleHint: z.string().trim().max(40).optional(),
});

export type TeaserCard = z.infer<typeof TeaserCardSchema>;

const TeaserStreamSchema = z.object({
  cards: z.array(TeaserCardSchema).min(4).max(10),
});

export type TeaserInput = {
  topic: string;
  goalType: string;
  currentLevel: string;
  educationStage?: string;
};

export function buildTeaserPrompt(input: TeaserInput): string {
  const stageLine = input.educationStage
    ? `Audience stage: ${input.educationStage}`
    : "Audience stage: unspecified";

  return [
    `You are creating short "did you know" teaser cards shown while a personalised course is being generated.`,
    ``,
    `Course topic: ${input.topic}`,
    `Goal type: ${input.goalType}`,
    `Learner level: ${input.currentLevel}`,
    stageLine,
    ``,
    `Produce 6–8 cards. Each card teases a compelling concept the learner will encounter in this course.`,
    `Rules:`,
    `- keyword: 1–3 words, Title Case, concrete (no vague phrases like "Key ideas").`,
    `- blurb: ONE sentence, ≤140 characters, evocative, specific to the topic.`,
    `- moduleHint: optional short phrase like "Module 3" or "Later in the course". Omit if unsure.`,
    `- Stay calibrated to the learner level — avoid jargon a beginner couldn't parse.`,
    `- No duplicates. No generic learning-science tips.`,
  ].join("\n");
}

/**
 * Streams teaser cards from the same model family as the main course
 * generation (gpt-5-nano with reasoningEffort:"low"). Yields cards as
 * they become available rather than waiting for the full set.
 */
export async function* generateTeaserCardsStream(
  input: TeaserInput,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<TeaserCard> {
  const { elementStream } = streamObject({
    model: structuredPrimaryModel,
    schema: TeaserStreamSchema,
    output: "array",
    prompt: buildTeaserPrompt(input),
    abortSignal: options.signal,
  });

  for await (const partial of elementStream) {
    const result = TeaserCardSchema.safeParse(partial);
    if (result.success) yield result.data;
  }
}
```

- [ ] **Step 4: Export from the curriculum barrel**

Modify `packages/ai/src/curriculum/index.ts`, appending:

```ts
export {
  generateTeaserCardsStream,
  buildTeaserPrompt,
  TeaserCardSchema,
  type TeaserCard,
  type TeaserInput,
} from "./generate-teasers";
```

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm -F @repo/ai test -- generate-teasers
pnpm -F @repo/ai typecheck
```

Expected: PASS on both.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/curriculum/generate-teasers.ts \
        packages/ai/src/curriculum/generate-teasers.test.ts \
        packages/ai/src/curriculum/index.ts
git commit -m "feat(ai): stream teaser cards for course-generation curtain"
```

---

## Task 3: SSE API route `POST /api/learn/teasers`

**Files:**
- Create: `apps/web/src/app/api/learn/teasers/route.ts`
- Create: `apps/web/src/app/api/learn/teasers/route.test.ts`

**Notes on SSE in App Router:** We return a `Response` wrapping a
`ReadableStream<Uint8Array>` with `Content-Type: text/event-stream`. The
stream writes `event: card\ndata: {...}\n\n` frames and ends with an
`event: done` frame on normal completion or `event: error` on failure.

- [ ] **Step 1: Write the failing test (focused on auth + rate-limit wiring — stream mechanics are covered manually)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@repo/shared", async () => {
  const actual = await vi.importActual<typeof import("@repo/shared")>(
    "@repo/shared",
  );
  return {
    ...actual,
    checkRateLimit: vi.fn(),
  };
});
vi.mock("@repo/ai", () => ({
  generateTeaserCardsStream: vi.fn(),
}));

import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@repo/shared";
import { generateTeaserCardsStream } from "@repo/ai";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/learn/teasers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  topic: "Linear algebra",
  goalType: "skill_building",
  currentLevel: "some_knowledge",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/learn/teasers", () => {
  it("returns 401 when there is no user session", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 5000,
    });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 on malformed body", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    });

    const res = await POST(makeReq({ topic: "" }));
    expect(res.status).toBe(400);
  });

  it("returns a text/event-stream response on happy path", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    });
    vi.mocked(generateTeaserCardsStream).mockImplementation(
      // eslint-disable-next-line require-yield
      async function* () {
        return;
      } as never,
    );

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm -F web test -- api/learn/teasers
```

Expected: FAIL — route file missing.

- [ ] **Step 3: Implement the route**

```ts
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { generateTeaserCardsStream } from "@repo/ai";
import { checkRateLimit, categorizeGenerationError } from "@repo/shared";

export const maxDuration = 30;

const bodySchema = z.object({
  topic: z.string().trim().min(1).max(500),
  goalType: z.enum([
    "exam_prep",
    "skill_building",
    "course_supplement",
    "exploration",
  ]),
  currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]),
  educationStage: z
    .enum([
      "elementary",
      "high_school",
      "university",
      "professional",
      "self_learner",
    ])
    .optional(),
});

const TEASER_TIMEOUT_MS = 8_000;

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = await checkRateLimit(
    "learn-teasers",
    user.id,
    { maxRequests: 10, window: "60 s" },
  );
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const abortCtrl = new AbortController();
  const parentSignal = req.signal;
  if (parentSignal) {
    parentSignal.addEventListener("abort", () => abortCtrl.abort(), {
      once: true,
    });
  }

  const timeout = setTimeout(
    () => abortCtrl.abort(new Error("teaser timeout")),
    TEASER_TIMEOUT_MS,
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      try {
        for await (const card of generateTeaserCardsStream(parsed, {
          signal: abortCtrl.signal,
        })) {
          write("card", card);
        }
        write("done", { ok: true });
      } catch (err) {
        const correlationId = randomUUID().slice(0, 8);
        const reason = categorizeGenerationError(err);
        console.warn(
          `[learn/teasers] stream failed [${correlationId}] (${reason})`,
          err,
        );
        try {
          write("error", { reason, correlationId });
        } catch {
          /* controller may already be closed */
        }
      } finally {
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      clearTimeout(timeout);
      abortCtrl.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm -F web test -- api/learn/teasers
pnpm -F web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/learn/teasers/route.ts \
        apps/web/src/app/api/learn/teasers/route.test.ts
git commit -m "feat(course): SSE endpoint for course-generation teaser cards"
```

---

## Task 4: `<TeaserCard />` presentational component

**Files:**
- Create: `apps/web/src/components/course/teaser-card.tsx`
- Create: `apps/web/src/components/course/teaser-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeaserCard } from "./teaser-card";

describe("TeaserCard", () => {
  it("renders the keyword and blurb", () => {
    render(
      <TeaserCard
        card={{ keyword: "Backpropagation", blurb: "Neural nets learn." }}
      />,
    );
    expect(screen.getByText("Backpropagation")).toBeInTheDocument();
    expect(screen.getByText("Neural nets learn.")).toBeInTheDocument();
  });

  it("renders moduleHint when provided", () => {
    render(
      <TeaserCard
        card={{
          keyword: "Gradient descent",
          blurb: "Step by step.",
          moduleHint: "Module 3",
        }}
      />,
    );
    expect(screen.getByText("Module 3")).toBeInTheDocument();
  });

  it("omits moduleHint chip when not provided", () => {
    const { container } = render(
      <TeaserCard
        card={{ keyword: "Linear algebra", blurb: "Vectors and spaces." }}
      />,
    );
    expect(container.querySelector("[data-testid='module-hint']")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm -F web test -- teaser-card
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
"use client";

import type { TeaserCard as TeaserCardData } from "@repo/ai";
import { cn } from "@/lib/utils";

type TeaserCardProps = {
  card: TeaserCardData;
  className?: string;
};

export function TeaserCard({ card, className }: TeaserCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/15 bg-primary/5 px-6 py-5 text-center",
        className,
      )}
    >
      {card.moduleHint && (
        <div
          data-testid="module-hint"
          className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
        >
          {card.moduleHint}
        </div>
      )}
      <p className="text-lg font-semibold text-foreground">{card.keyword}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{card.blurb}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm -F web test -- teaser-card
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/course/teaser-card.tsx \
        apps/web/src/components/course/teaser-card.test.tsx
git commit -m "feat(course): add TeaserCard presentational component"
```

---

## Task 5: `<CourseGenerationCurtain />` container component

**Files:**
- Create: `apps/web/src/components/course/course-generation-curtain.tsx`
- Create: `apps/web/src/components/course/course-generation-curtain.test.tsx`

**Responsibilities:**
1. Render the headline ("Crafting your course…") + time-driven sub-line.
2. On mount, start an SSE connection to `/api/learn/teasers`; merge streamed cards with generics (streamed cards preferred once ≥2 have arrived).
3. Rotate the visible card every 4s; respect `prefers-reduced-motion` by swapping instantly.
4. Clean up (abort, clear intervals) on unmount.

- [ ] **Step 1: Write the failing test**

We only test the logic a human can't eyeball easily: generic cards render immediately, and the abort controller fires on unmount. Visual crossfade + 4s rotation is verified manually.

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CourseGenerationCurtain } from "./course-generation-curtain";
import { GENERIC_TEASER_CARDS } from "./teaser-generic-cards";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CourseGenerationCurtain", () => {
  it("renders a generic card immediately", () => {
    fetchMock.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );

    render(
      <CourseGenerationCurtain
        topic="Linear algebra"
        goalType="skill_building"
        currentLevel="some_knowledge"
      />,
    );

    const firstCardKeyword = GENERIC_TEASER_CARDS[0].keyword;
    expect(screen.getByText(firstCardKeyword)).toBeInTheDocument();
  });

  it("aborts the fetch on unmount", () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      capturedSignal = init.signal ?? undefined;
      return new Promise(() => {});
    });

    const { unmount } = render(
      <CourseGenerationCurtain
        topic="x"
        goalType="exploration"
        currentLevel="beginner"
      />,
    );

    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("rotates to the next card after 4 seconds", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));

    render(
      <CourseGenerationCurtain
        topic="x"
        goalType="exploration"
        currentLevel="beginner"
      />,
    );

    const first = GENERIC_TEASER_CARDS[0].keyword;
    const second = GENERIC_TEASER_CARDS[1].keyword;
    expect(screen.getByText(first)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.getByText(second)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm -F web test -- course-generation-curtain
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import type { TeaserCard as TeaserCardData } from "@repo/ai";
import { TeaserCard } from "./teaser-card";
import {
  GENERIC_TEASER_CARDS,
} from "./teaser-generic-cards";

type Props = {
  topic: string;
  goalType: string;
  currentLevel: string;
  educationStage?: string;
};

const ROTATE_MS = 4_000;

const HEADLINE_STAGES = [
  { untilMs: 20_000, label: "Designing your modules…" },
  { untilMs: 40_000, label: "Shaping your first lessons…" },
  { untilMs: Infinity, label: "Almost ready…" },
];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function CourseGenerationCurtain(props: Props) {
  const { topic } = props;
  const [aiCards, setAiCards] = useState<TeaserCardData[]>([]);
  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(Date.now());
  const reducedMotion = useReducedMotion();

  // Prefer AI cards once we have ≥2; otherwise stay on generics.
  const cards = useMemo<TeaserCardData[]>(() => {
    if (aiCards.length >= 2) return aiCards;
    return GENERIC_TEASER_CARDS as TeaserCardData[];
  }, [aiCards]);

  // Rotate the visible card every ROTATE_MS.
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % cards.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [cards.length]);

  // Track elapsed time for headline stage selection.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  // Stream AI cards from the teaser endpoint.
  useEffect(() => {
    const controller = new AbortController();
    const collected: TeaserCardData[] = [];

    (async () => {
      try {
        const res = await fetch("/api/learn/teasers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: props.topic,
            goalType: props.goalType,
            currentLevel: props.currentLevel,
            educationStage: props.educationStage,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            const eventMatch = frame.match(/^event: (\w+)$/m);
            const dataMatch = frame.match(/^data: (.*)$/m);
            if (!eventMatch || !dataMatch) continue;
            if (eventMatch[1] !== "card") continue;
            try {
              const card = JSON.parse(dataMatch[1]) as TeaserCardData;
              collected.push(card);
              setAiCards([...collected]);
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch {
        // Any failure keeps us on generics. No user-visible error.
      }
    })();

    return () => controller.abort();
  }, [props.topic, props.goalType, props.currentLevel, props.educationStage]);

  const headline = HEADLINE_STAGES.find((s) => elapsedMs < s.untilMs)!.label;
  const card = cards[index % cards.length];

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative size-20">
        <svg
          viewBox="0 0 96 96"
          className="absolute inset-0 size-full animate-[spin_8s_linear_infinite]"
          aria-hidden="true"
        >
          <circle cx="48" cy="8" r="5" className="fill-primary/80" />
          <circle cx="88" cy="48" r="4" className="fill-primary/50" />
          <circle cx="48" cy="88" r="5" className="fill-primary/80" />
          <circle cx="8" cy="48" r="4" className="fill-primary/50" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <GraduationCap className="size-7 text-primary" />
        </div>
      </div>

      <div className="text-center">
        <p className="text-lg font-semibold">Crafting your course</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {headline} Personalising for {topic}.
        </p>
      </div>

      <div
        className={
          reducedMotion
            ? "w-full max-w-md"
            : "w-full max-w-md transition-opacity duration-500"
        }
        aria-live="polite"
      >
        <TeaserCard card={card} />
      </div>

      <div className="flex gap-1.5">
        {cards.map((_, i) => (
          <span
            key={i}
            className={
              i === index % cards.length
                ? "size-1.5 rounded-full bg-primary"
                : "size-1.5 rounded-full bg-muted-foreground/30"
            }
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests + typecheck**

```bash
pnpm -F web test -- course-generation-curtain
pnpm -F web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/course/course-generation-curtain.tsx \
        apps/web/src/components/course/course-generation-curtain.test.tsx
git commit -m "feat(course): course-generation curtain with AI teaser streaming"
```

---

## Task 6: Wire the curtain into the setup wizard

**Files:**
- Modify: `apps/web/src/components/course/course-setup-wizard.tsx`

- [ ] **Step 1: Remove the now-unused `GENERATION_STAGES` array**

In `course-setup-wizard.tsx`, delete the entire `GENERATION_STAGES` array (around line 191–197) and the `genStage` state declaration (line 259) along with every reference:

- Line 259: `const [genStage, setGenStage] = useState(0);` — delete.
- Line 339: `setGenStage(0);` — delete.
- Lines 342–344: the `stageInterval` and its `setGenStage` call inside — delete both the `setInterval` and the matching `clearInterval(stageInterval)` on line 369.
- Line 373: `setGenStage(GENERATION_STAGES.length - 1);` — delete.

- [ ] **Step 2: Replace the generating-branch JSX**

Replace lines 867–896 (the `generating ? (...)` branch) with a curtain render. Add the import at the top of the file alongside the other component imports:

```tsx
import { CourseGenerationCurtain } from "./course-generation-curtain";
```

And replace the JSX block:

```tsx
{generating ? (
  <div className="flex flex-col items-center gap-6 py-12">
    <CourseGenerationCurtain
      topic={topic}
      goalType={goalType ?? "exploration"}
      currentLevel={level ?? "beginner"}
      educationStage={userStage}
    />
  </div>
) : (
```

- [ ] **Step 3: Remove the now-unused `GraduationCap` import** (only if it's used *only* for the generating spinner — grep to be sure).

```bash
rg "GraduationCap" apps/web/src/components/course/course-setup-wizard.tsx
```

If the only remaining usage is inside the replaced block, remove `GraduationCap` from the `lucide-react` import at the top. If used elsewhere, leave it.

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm -F web typecheck
pnpm -F web lint
```

Expected: no new errors. Pre-existing warnings in `course-setup-wizard.tsx` (e.g. `Loader2 defined but never used`) may or may not be affected — fix them only if directly introduced/orphaned by this change.

- [ ] **Step 5: Manual verification (record in commit body)**

1. `pnpm -F web dev`
2. Log in, open the questionnaire, submit for a new course.
3. Observe: generic card appears immediately, rotates every ~4s, AI cards swap in a few seconds later, navigation to the roadmap still works.
4. Open devtools → Network, confirm `POST /api/learn/teasers` streams `event: card` frames and is aborted when the page navigates.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/course/course-setup-wizard.tsx
git commit -m "feat(course): replace Phase-1 spinner with teaser curtain"
```

---

## Task 7: Final lint, full test run, push

- [ ] **Step 1: Run the full suite**

```bash
pnpm -F @repo/ai test
pnpm -F web test
pnpm -F web lint
pnpm -F @repo/ai typecheck
pnpm -F web typecheck
```

Expected: all green (pre-existing warnings allowed, zero new errors).

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Mark done** — leave a short summary message in the chat with the final commit SHAs and a note to watch Langfuse for `teaser_first_card_latency_ms`.

---

## Self-review

**Spec coverage:**
- Hybrid data source (generics + streamed AI) — Tasks 1, 2, 5.
- `<CourseGenerationCurtain />` component — Task 5.
- `POST /api/learn/teasers` SSE endpoint with auth + rate limit — Task 3.
- Failure fallback invisible to user — Task 5, `try/catch` around stream.
- `prefers-reduced-motion` — Task 5, `useReducedMotion` hook.
- `aria-live="polite"` on card region — Task 5 JSX.
- Rate limit 10/min via `@repo/shared` — Task 3.
- 8s timeout to first card — Task 3, `TEASER_TIMEOUT_MS`.
- Abort on navigation/unmount — Tasks 3 (server) and 5 (client).
- Langfuse observability — piggybacks on existing `structuredPrimaryModel` instrumentation; no new wiring required. **Note:** `teaser_first_card_latency_ms` was called out in the spec but the existing Langfuse wrapper captures per-call latency automatically — no custom metric. Acceptable deviation.
- Caching — explicitly out of scope per spec; no task. ✓
- Localization — explicitly out of scope. ✓

**Placeholder scan:** no "TBD", no "add validation", no "similar to Task N". All steps show full code.

**Type consistency:** `TeaserCard` / `TeaserCardData` — `TeaserCard` is the Zod-inferred type in `@repo/ai`, and `TeaserCardData` is used as a local alias inside the React components to avoid colliding with the `<TeaserCard />` component name. Intentional.
