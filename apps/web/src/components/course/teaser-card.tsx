"use client";

import type { TeaserCard as TeaserCardData } from "@repo/ai";
import { cn } from "@/lib/utils";

type TeaserCardProps = {
  card: TeaserCardData;
  className?: string;
};

/**
 * Presentational card for a single teaser (keyword + one-line blurb).
 * Stays visually quiet so that rotating between cards feels calm rather
 * than frantic during the course-generation wait.
 */
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
