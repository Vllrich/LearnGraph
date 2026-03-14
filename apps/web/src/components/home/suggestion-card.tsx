"use client";

import { useState, useRef, useCallback } from "react";
import {
  X,
  Sparkles,
  Flame,
  Puzzle,
  Shuffle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SuggestionVariant = "ai" | "trending" | "gap" | "random";

type SuggestionCardProps = {
  title: string;
  subtitle: string;
  reason?: string | null;
  variant: SuggestionVariant;
  enrollCount?: number;
  prerequisiteFor?: string[];
  onSelect: (title: string) => void;
  onDismiss: () => void;
};

const VARIANT_CONFIG: Record<
  SuggestionVariant,
  { icon: typeof Sparkles; accent: string; label: string }
> = {
  ai: {
    icon: Sparkles,
    accent: "from-violet-500/10 to-indigo-500/10 border-violet-500/20",
    label: "For you",
  },
  trending: {
    icon: TrendingUp,
    accent: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
    label: "Trending",
  },
  gap: {
    icon: Puzzle,
    accent: "from-rose-500/10 to-pink-500/10 border-rose-500/20",
    label: "Fill the gap",
  },
  random: {
    icon: Shuffle,
    accent: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20",
    label: "Discovery",
  },
};

export function SuggestionCard({
  title,
  subtitle,
  reason,
  variant,
  enrollCount,
  prerequisiteFor,
  onSelect,
  onDismiss,
}: SuggestionCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDismissing(true);
      setTimeout(onDismiss, 200);
    },
    [onDismiss]
  );

  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect(title)}
      className={cn(
        "group relative flex cursor-pointer flex-col items-start rounded-xl border bg-linear-to-br px-5 py-4 text-left transition-all duration-200",
        config.accent,
        dismissing && "scale-95 opacity-0",
        !dismissing && "hover:shadow-sm hover:border-primary/30"
      )}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
        aria-label={`Dismiss ${title}`}
      >
        <X className="size-3" />
      </button>

      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground/60" />
        <span className="text-sm font-medium">{title}</span>
      </div>

      <span className="mt-0.5 text-[11px] text-muted-foreground/60">
        {subtitle}
      </span>

      {reason && (
        <span className="mt-1.5 text-[11px] leading-snug text-muted-foreground/80 italic line-clamp-2">
          {reason}
        </span>
      )}

      {variant === "trending" && enrollCount && enrollCount > 1 && (
        <span className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <Flame className="size-2.5" />
          {enrollCount} learners this month
        </span>
      )}

      {variant === "gap" && prerequisiteFor && prerequisiteFor.length > 0 && (
        <span className="mt-1.5 text-[10px] text-rose-600 dark:text-rose-400 line-clamp-1">
          Needed for: {prerequisiteFor.join(", ")}
        </span>
      )}
    </div>
  );
}

export function SuggestionCardSkeleton() {
  return (
    <div className="flex flex-col items-start rounded-xl border border-border/30 bg-card px-5 py-4 animate-pulse">
      <div className="flex items-center gap-1.5">
        <div className="size-3.5 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="mt-1.5 h-3 w-32 rounded bg-muted/70" />
      <div className="mt-2 h-3 w-40 rounded bg-muted/50" />
    </div>
  );
}
