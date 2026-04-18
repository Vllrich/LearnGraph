"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Layers, RotateCcw } from "lucide-react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import type { ContentData } from "./types";

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export function FlashcardsTab({
  data,
}: {
  data: ContentData;
  learningObjectId: string;
}) {
  const submitMutation = trpc.review.submitReview.useMutation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<Record<number, boolean>>({});

  const cards = data.concepts.filter((c) => c.definition);

  if (cards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Layers className="mb-3 size-5 text-muted-foreground/30" />
        <p className="text-[13px] font-medium text-foreground/70">No flashcards yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">
          Flashcards are generated from extracted concepts. Check back once ingestion completes.
        </p>
      </div>
    );
  }

  const card = cards[currentIdx]!;
  const totalRated = Object.keys(rated).length;
  const progress = Math.round((totalRated / cards.length) * 100);

  const goTo = (idx: number) => {
    setCurrentIdx(idx);
    setFlipped(false);
  };

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    setRated((prev) => ({ ...prev, [currentIdx]: true }));
    try {
      await submitMutation.mutateAsync({
        conceptId: card.id,
        rating,
        isCorrect: rating >= 3,
      });
    } catch {
      /* non-blocking */
    }
    const next = currentIdx + 1 < cards.length ? currentIdx + 1 : currentIdx;
    goTo(next);
  };

  const ratingButtons = [
    { rating: 1 as const, label: "Again", color: "text-red-500", border: "hover:border-red-500/40" },
    { rating: 2 as const, label: "Hard", color: "text-orange-500", border: "hover:border-orange-500/40" },
    { rating: 3 as const, label: "Good", color: "text-blue-500", border: "hover:border-blue-500/40" },
    { rating: 4 as const, label: "Easy", color: "text-green-500", border: "hover:border-green-500/40" },
  ];

  const allDone = totalRated === cards.length;

  if (allDone) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="mb-3 size-6 text-green-500/70" />
        <p className="text-[14px] font-semibold text-foreground/85">Session complete!</p>
        <p className="mt-1 text-[12px] text-muted-foreground/60">
          You reviewed all {cards.length} flashcards.
        </p>
        <button
          onClick={() => {
            setRated({});
            goTo(0);
          }}
          className="mt-4 flex items-center gap-1.5 rounded-full border border-border/40 px-4 py-1.5 text-[12px] text-muted-foreground/70 transition-all hover:border-border/70 hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Study again
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500/60 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground/40">
          {totalRated}/{cards.length}
        </span>
      </div>

      <div
        className="relative flex-1 cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative h-full w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-muted/20 px-6 py-8"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Concept
            </span>
            <p className="text-center text-[18px] font-semibold leading-snug text-foreground/90">
              {card.displayName}
            </p>
            {card.difficultyLevel != null && (
              <span className="mt-4 rounded-full bg-muted/50 px-2.5 py-0.5 text-[10px] text-muted-foreground/50">
                {DIFFICULTY_LABEL[card.difficultyLevel] ?? `Level ${card.difficultyLevel}`}
              </span>
            )}
            <p className="mt-6 text-[11px] text-muted-foreground/35">Tap to reveal definition</p>
          </div>

          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-card px-6 py-8"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Definition
            </span>
            <p className="text-center text-[13px] leading-relaxed text-foreground/80">
              {card.definition}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {flipped ? (
          <>
            <p className="text-center text-[10px] text-muted-foreground/40">
              How well did you know this?
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {ratingButtons.map(({ rating, label, color, border }) => (
                <button
                  key={rating}
                  onClick={() => handleRate(rating)}
                  disabled={submitMutation.isPending}
                  className={cn(
                    "rounded-xl border border-border/30 py-2 text-center transition-all hover:bg-muted/20",
                    border
                  )}
                >
                  <p className={cn("text-[11px] font-semibold", color)}>{label}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full rounded-xl bg-foreground py-2.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Reveal
          </button>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => goTo(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground disabled:opacity-20"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </button>
          <div className="flex gap-1">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "size-1.5 rounded-full transition-all",
                  i === currentIdx
                    ? "bg-foreground/70 scale-125"
                    : rated[i]
                      ? "bg-green-500/50"
                      : "bg-border/50 hover:bg-border/80"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => goTo(Math.min(cards.length - 1, currentIdx + 1))}
            disabled={currentIdx === cards.length - 1}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground disabled:opacity-20"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
