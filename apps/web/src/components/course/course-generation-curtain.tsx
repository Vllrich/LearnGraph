"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
import type { TeaserCard as TeaserCardData } from "@repo/ai";
import { TeaserCard } from "./teaser-card";
import { GENERIC_TEASER_CARDS } from "./teaser-generic-cards";
import {
  pickActiveCards,
  pickHeadlineLabel,
  parseSseFrame,
  splitSseBuffer,
} from "./course-generation-curtain-logic";

/**
 * Replaces the Phase-1 "generating your course" spinner with a rotating
 * curtain of keyword + one-line teaser cards.
 *
 * Behaviour:
 * - Immediately shows hand-authored generic cards so the screen is
 *   never empty.
 * - In parallel, opens an SSE stream to POST /api/learn/teasers and
 *   swaps in course-specific cards once at least two have arrived.
 * - Any failure (network, auth, rate limit, timeout, abort) silently
 *   keeps the generic rotation going — the user never sees an error.
 * - Aborts the stream on unmount to avoid billing orphan LLM tokens.
 * - Respects `prefers-reduced-motion`: no fade transition.
 */

type Props = {
  topic: string;
  goalType: string;
  currentLevel: string;
  educationStage?: string;
};

const ROTATE_MS = 4_000;
const TICK_MS = 1_000;

function useReducedMotion(): boolean {
  // Lazy initializer reads the current value at mount (outside render),
  // the effect then subscribes only to future *changes* — no synchronous
  // setState inside the effect body.
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function CourseGenerationCurtain(props: Props) {
  const { topic, goalType, currentLevel, educationStage } = props;

  const [aiCards, setAiCards] = useState<TeaserCardData[]>([]);
  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  // `useState` initializer runs exactly once; keeps the mount time
  // out of the render phase (where calling `Date.now()` would violate
  // `react-hooks/purity`).
  const [startedAt] = useState<number>(() => Date.now());
  const reducedMotion = useReducedMotion();

  const cards = useMemo<readonly TeaserCardData[]>(
    () =>
      pickActiveCards(
        aiCards,
        GENERIC_TEASER_CARDS as readonly TeaserCardData[],
      ),
    [aiCards],
  );

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % Math.max(cards.length, 1)),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [cards.length]);

  useEffect(() => {
    const id = setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/learn/teasers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            goalType,
            currentLevel,
            educationStage,
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

          const { frames, rest } = splitSseBuffer(buffer);
          buffer = rest;

          for (const frame of frames) {
            const parsed = parseSseFrame(frame);
            if (!parsed || parsed.event !== "card") continue;
            const card = parsed.data as TeaserCardData;
            if (
              typeof card?.keyword === "string" &&
              typeof card?.blurb === "string"
            ) {
              setAiCards((prev) => [...prev, card]);
            }
          }
        }
      } catch {
        // Silent fallback to generics. Logged server-side already.
      }
    })();

    return () => controller.abort();
  }, [topic, goalType, currentLevel, educationStage]);

  const headline = pickHeadlineLabel(elapsedMs);
  const safeIndex = cards.length > 0 ? index % cards.length : 0;
  const card = cards[safeIndex];

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

      {card && (
        <div className="w-full max-w-md" role="status">
          <TeaserCard
            // Key on keyword+index forces a remount each rotation so
            // `animate-in` replays. On reduced-motion we skip the
            // animation classes and just swap content instantly.
            key={`${safeIndex}-${card.keyword}`}
            card={card}
            className={
              reducedMotion ? undefined : "animate-in fade-in-0 duration-500"
            }
          />
        </div>
      )}

      {cards.length > 1 && (
        <div className="flex gap-1.5" aria-hidden="true">
          {cards.map((_, i) => (
            <span
              key={i}
              className={
                i === safeIndex
                  ? "size-1.5 rounded-full bg-primary"
                  : "size-1.5 rounded-full bg-muted-foreground/30"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
