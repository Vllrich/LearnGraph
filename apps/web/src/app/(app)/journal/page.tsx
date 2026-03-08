"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function JournalPage() {
  const [weeksBack, setWeeksBack] = useState(0);
  const { data, isLoading } = trpc.gamification.getWeeklyJournal.useQuery({ weeksBack });

  const weekLabel =
    weeksBack === 0 ? "This week" : weeksBack === 1 ? "Last week" : `${weeksBack} weeks ago`;
  const weekStartDate = data?.weekStart
    ? new Date(data.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Learning Journal</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {/* Week navigation */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setWeeksBack((w) => Math.min(w + 1, 12))}
              className="flex items-center gap-1 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </button>
            <div className="text-center">
              <p className="text-[14px] font-medium">{weekLabel}</p>
              {weekStartDate && (
                <p className="text-[11px] text-muted-foreground/40">Week of {weekStartDate}</p>
              )}
            </div>
            <button
              onClick={() => setWeeksBack((w) => Math.max(w - 1, 0))}
              disabled={weeksBack === 0}
              className="flex items-center gap-1 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30"
            >
              Next
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/30 px-6 py-6 text-center mb-4">
            <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-[13px] font-medium mb-1">Your weekly learning journal</p>
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">
              Each week, your journal automatically tracks reviews completed, concepts mastered or struggled with, and your overall accuracy — so you can see your progress at a glance.
            </p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="rounded-xl border border-border/30 bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="size-4 text-primary" />
                  <span className="text-[13px] font-medium">Weekly Summary</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground font-(family-name:--font-source-serif)">
                  {data.reviewsCompleted > 0 ? (
                    <>
                      This week you completed{" "}
                      <strong className="text-foreground">{data.reviewsCompleted} reviews</strong>
                      {data.conceptsMastered > 0 && (
                        <>
                          {" "}
                          and mastered{" "}
                          <strong className="text-green-600 dark:text-green-400">
                            {data.conceptsMastered} concepts
                          </strong>
                        </>
                      )}
                      {data.conceptsStruggled > 0 && (
                        <>
                          {", while struggling with "}
                          <strong className="text-amber-600 dark:text-amber-400">
                            {data.conceptsStruggled} concepts
                          </strong>
                        </>
                      )}
                      . Your accuracy was{" "}
                      <strong
                        className={cn(
                          (data.averageAccuracy ?? 0) >= 70
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {data.averageAccuracy ?? 0}%
                      </strong>
                      .
                    </>
                  ) : (
                    <>No review activity this week. Start a session to build momentum!</>
                  )}
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: Zap,
                    label: "Reviews",
                    value: data.reviewsCompleted,
                    color: "text-green-500",
                  },
                  {
                    icon: TrendingUp,
                    label: "Mastered",
                    value: data.conceptsMastered,
                    color: "text-emerald-500",
                  },
                  {
                    icon: AlertTriangle,
                    label: "Struggled",
                    value: data.conceptsStruggled,
                    color: "text-amber-500",
                  },
                  {
                    icon: TrendingUp,
                    label: "Accuracy",
                    value: `${data.averageAccuracy ?? 0}%`,
                    color: "text-blue-500",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="rounded-xl border border-border/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("size-4", color)} />
                      <span className="text-[11px] text-muted-foreground/50">{label}</span>
                    </div>
                    <p className="mt-1 text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              {data.reviewsCompleted === 0 && (
                <div className="mt-4 text-center">
                  <Link
                    href="/review"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground"
                  >
                    <Zap className="size-3.5" />
                    Start reviewing
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
