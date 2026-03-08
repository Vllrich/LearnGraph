"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, Loader2, Target, Zap, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];
const MASTERY_LABELS = ["Unknown", "Exposed", "Practicing", "Familiar", "Proficient", "Mastered"];

export default function GapsPage() {
  const { data: goals } = trpc.goals.getActive.useQuery();
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);

  const { data, isLoading } = trpc.gaps.detectGaps.useQuery(
    { goalId: selectedGoalId },
    { enabled: true }
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Knowledge Gaps</span>
        <span className="text-[11px] text-muted-foreground/40">
          {data?.totalGaps ?? 0} gaps found
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Goal filter */}
          {goals && goals.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground/60">
                Filter by course
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGoalId(undefined)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] transition-colors",
                    !selectedGoalId
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border/30 text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  All concepts
                </button>
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGoalId(g.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] transition-colors",
                      selectedGoalId === g.id
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border/30 text-muted-foreground/60 hover:text-foreground"
                    )}
                  >
                    {g.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && data?.gaps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-green-500/10">
                <Target className="size-6 text-green-500" />
              </div>
              <h2 className="text-lg font-medium">No gaps detected!</h2>
              <p className="mt-1 text-[13px] text-muted-foreground/60">
                You&apos;re on track. Keep reviewing to maintain your knowledge.
              </p>
            </div>
          )}

          {data && data.gaps.length > 0 && (
            <div className="space-y-3">
              {data.gaps.map((gap, idx) => (
                <div
                  key={gap.conceptId}
                  className="rounded-xl border border-border/30 p-4 transition-all hover:border-border/60"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground/40 font-mono tabular-nums">
                          #{idx + 1}
                        </span>
                        <h3 className="text-[14px] font-medium truncate">{gap.conceptName}</h3>
                        {gap.domain && (
                          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground/50">
                            {gap.domain}
                          </span>
                        )}
                      </div>
                      {gap.definition && (
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/60 line-clamp-2">
                          {gap.definition}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: MASTERY_COLORS[gap.mastery] }}
                        />
                        <span className="text-[11px] font-medium">
                          {MASTERY_LABELS[gap.mastery]}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/40">
                        Priority: {gap.priority}
                      </span>
                    </div>
                  </div>

                  {gap.prerequisiteFor.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        Prerequisite for: {gap.prerequisiteFor.slice(0, 3).join(", ")}
                        {gap.prerequisiteFor.length > 3 &&
                          ` +${gap.prerequisiteFor.length - 3} more`}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Link
                      href="/review"
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-all hover:bg-primary/20"
                    >
                      <Zap className="size-3" />
                      Review now
                    </Link>
                    <Link
                      href="/graph"
                      className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] text-muted-foreground transition-all hover:border-border/60"
                    >
                      <ArrowUpRight className="size-3" />
                      View in graph
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
