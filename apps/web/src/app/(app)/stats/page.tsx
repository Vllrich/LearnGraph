"use client";

import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Flame, Brain, Target, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];
const RATING_LABELS: Record<number, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

export default function StatsPage() {
  const { data, isLoading } = trpc.review.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mastery = data?.mastery;
  const masteryData = mastery
    ? [
        { name: "Unknown", value: Number(mastery.m0), fill: MASTERY_COLORS[0] },
        { name: "Exposed", value: Number(mastery.m1), fill: MASTERY_COLORS[1] },
        { name: "Practicing", value: Number(mastery.m2), fill: MASTERY_COLORS[2] },
        { name: "Familiar", value: Number(mastery.m3), fill: MASTERY_COLORS[3] },
        { name: "Proficient", value: Number(mastery.m4), fill: MASTERY_COLORS[4] },
        { name: "Mastered", value: Number(mastery.m5), fill: MASTERY_COLORS[5] },
      ]
    : [];

  const totalConcepts = masteryData.reduce((a, b) => a + b.value, 0);
  const streak = data?.streak ?? 0;
  const recentReviews = data?.recentReviews ?? [];
  const correctCount = recentReviews.filter((r) => r.rating >= 3).length;
  const accuracy =
    recentReviews.length > 0 ? Math.round((correctCount / recentReviews.length) * 100) : 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Progress</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Flame, label: "Streak", value: `${streak}d`, color: "text-amber-500" },
              {
                icon: Brain,
                label: "Concepts",
                value: String(totalConcepts),
                color: "text-primary",
              },
              {
                icon: Target,
                label: "Reviews",
                value: String(recentReviews.length),
                color: "text-green-500",
              },
              {
                icon: TrendingUp,
                label: "Accuracy",
                value: `${accuracy}%`,
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

          {/* Mastery distribution */}
          {totalConcepts > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-[13px] font-medium">Mastery Distribution</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={masteryData} barSize={32}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#71717a" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#71717a" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {masteryData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent reviews */}
          {recentReviews.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-[13px] font-medium">Recent Reviews</h2>
              <div className="space-y-1">
                {recentReviews.slice(0, 20).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px]">{r.conceptName ?? "Unknown concept"}</p>
                      <p className="text-[11px] text-muted-foreground/40">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        r.rating >= 3
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      )}
                    >
                      {RATING_LABELS[r.rating] ?? r.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalConcepts === 0 && recentReviews.length === 0 && (
            <div className="mt-16 text-center">
              <p className="text-[13px] text-muted-foreground/50">
                No review data yet. Complete some reviews to see your progress.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
