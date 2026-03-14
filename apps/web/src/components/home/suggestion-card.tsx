"use client";

import { useState, useCallback } from "react";
import { X, Sparkles, Flame, Puzzle, Shuffle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip-card";

export type SuggestionVariant = "ai" | "trending" | "gap" | "random";

function toTitleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

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
  { tooltipIcon: typeof Sparkles; bg: string; border: string; iconColor: string; accentBorder: string }
> = {
  ai: {
    tooltipIcon: Sparkles,
    bg: "hover:bg-violet-500/10",
    border: "border-violet-500/20 hover:border-violet-500/40",
    iconColor: "text-violet-500/70",
    accentBorder: "border-l-violet-500",
  },
  trending: {
    tooltipIcon: TrendingUp,
    bg: "hover:bg-amber-500/10",
    border: "border-amber-500/20 hover:border-amber-500/40",
    iconColor: "text-amber-500/70",
    accentBorder: "border-l-amber-500",
  },
  gap: {
    tooltipIcon: Puzzle,
    bg: "hover:bg-rose-500/10",
    border: "border-rose-500/20 hover:border-rose-500/40",
    iconColor: "text-rose-500/70",
    accentBorder: "border-l-rose-500",
  },
  random: {
    tooltipIcon: Shuffle,
    bg: "hover:bg-emerald-500/10",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    iconColor: "text-emerald-500/70",
    accentBorder: "border-l-emerald-500",
  },
};

function TooltipBody(props: SuggestionCardProps) {
  const config = VARIANT_CONFIG[props.variant];
  return (
    <div className={cn("border-l-2 pl-3", config.accentBorder)}>
      <p className="text-sm font-semibold text-foreground">{props.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{props.subtitle}</p>
      {props.reason && (
        <p className="mt-1.5 text-xs italic text-muted-foreground/80">
          {props.reason}
        </p>
      )}
      {props.variant === "trending" && props.enrollCount && props.enrollCount > 1 && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <Flame className="size-3" />
          {props.enrollCount} learners this month
        </p>
      )}
      {props.variant === "gap" && props.prerequisiteFor && props.prerequisiteFor.length > 0 && (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          Needed for: {props.prerequisiteFor.join(", ")}
        </p>
      )}
    </div>
  );
}

export function SuggestionCard(props: SuggestionCardProps) {
  const { title, variant, onSelect, onDismiss } = props;
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDismissing(true);
      setTimeout(onDismiss, 200);
    },
    [onDismiss]
  );

  const config = VARIANT_CONFIG[variant];

  return (
    <Tooltip content={<TooltipBody {...props} />}>
      <button
        onClick={() => onSelect(title)}
        className={cn(
          "group relative inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
          config.border,
          config.bg,
          dismissing && "scale-90 opacity-0",
        )}
      >
        <span className="truncate">{toTitleCase(title)}</span>
        <span
          role="button"
          onClick={handleDismiss}
          className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label={`Dismiss ${title}`}
        >
          <X className="size-2.5" />
        </span>
      </button>
    </Tooltip>
  );
}

export function SuggestionCardSkeleton() {
  return (
    <div className="inline-flex h-9 w-28 animate-pulse items-center rounded-full border border-border/30 bg-muted/40" />
  );
}
