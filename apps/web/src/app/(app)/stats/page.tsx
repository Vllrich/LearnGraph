"use client";

import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Flame,
  Brain,
  Target,
  TrendingUp,
  TrendingDown,
  Loader2,
  Clock,
  AlertTriangle,
  Zap,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];
const RATING_LABELS: Record<number, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

export default function StatsPage() {
  const { data, isLoading } = trpc.review.getStats.useQuery();
  const { data: retention } = trpc.analytics.getRetentionCurve.useQuery({ days: 30 });
  const { data: efficiency } = trpc.analytics.getStudyEfficiency.useQuery();
  const { data: readiness } = trpc.analytics.getPredictedReadiness.useQuery({ daysFromNow: 7 });
  const { data: bestTimes } = trpc.analytics.getBestStudyTimes.useQuery();
  const { data: comparative } = trpc.analytics.getComparativeStats.useQuery();
  const { data: streak } = trpc.gamification.getStreakAndXp.useQuery();

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
  const recentReviews = data?.recentReviews ?? [];
  const correctCount = recentReviews.filter((r) => r.rating >= 3).length;
  const accuracy =
    recentReviews.length > 0 ? Math.round((correctCount / recentReviews.length) * 100) : 0;

  const retentionData = (retention?.dailyAccuracy ?? []).map((d) => ({
    date: new Date(d.review_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    accuracy: d.accuracy,
    reviews: d.total,
  }));

  const efficiencyData = (efficiency?.weeklyData ?? []).map((d) => ({
    week: new Date(d.week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    reviews: d.reviews,
    mastery: d.mastery_gained,
  }));

  const hourlyData = (bestTimes?.hourlyPerformance ?? []).map((d) => ({
    hour: `${d.hour}:00`,
    accuracy: d.accuracy,
    total: d.total,
  }));

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Progress & Analytics</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Top stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              {
                icon: Flame,
                label: "Streak",
                value: `${streak?.currentStreak ?? data?.streak ?? 0}d`,
                color: "text-amber-500",
              },
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
              {
                icon: Zap,
                label: "XP",
                value: (streak?.totalXp ?? 0).toLocaleString(),
                color: "text-violet-500",
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

          {/* Comparative stats banner */}
          {comparative && comparative.reviewChange !== 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/30 bg-card px-4 py-3">
              {comparative.reviewChange > 0 ? (
                <TrendingUp className="size-4 text-green-500" />
              ) : (
                <TrendingDown className="size-4 text-red-400" />
              )}
              <span className="text-[13px]">
                You&apos;ve reviewed{" "}
                <strong
                  className={
                    comparative.reviewChange > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {Math.abs(comparative.reviewChange)}%{" "}
                  {comparative.reviewChange > 0 ? "more" : "less"}
                </strong>{" "}
                than last week
                {comparative.conceptsMasteredThisWeek > 0 && (
                  <>
                    {" "}
                    and mastered{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {comparative.conceptsMasteredThisWeek} concepts
                    </strong>
                  </>
                )}
              </span>
            </div>
          )}

          {/* Predicted readiness */}
          {readiness && readiness.totalConcepts > 0 && (
            <div className="mt-4 rounded-xl border border-border/30 bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-violet-500" />
                  <span className="text-[13px] font-medium">7-Day Readiness Prediction</span>
                </div>
                <span
                  className={cn(
                    "text-lg font-bold",
                    readiness.readinessScore >= 70
                      ? "text-green-500"
                      : readiness.readinessScore >= 40
                        ? "text-amber-500"
                        : "text-red-400"
                  )}
                >
                  {readiness.readinessScore}%
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground/60">
                In 7 days, you&apos;re predicted to recall{" "}
                <strong>{readiness.likelyRecalled}</strong> of{" "}
                <strong>{readiness.totalConcepts}</strong> studied concepts.
              </p>
              {readiness.atRiskConcepts.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    At-risk concepts
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {readiness.atRiskConcepts.slice(0, 5).map((c) => (
                      <span
                        key={c.conceptId}
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        {c.conceptName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Retention curve */}
          {retentionData.length > 2 && (
            <div className="mt-8">
              <h2 className="mb-4 text-[13px] font-medium">Daily Accuracy (30 days)</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={retentionData}>
                    <defs>
                      <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#71717a" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "#71717a" }}
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
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#6366f1"
                      fill="url(#accuracyGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Study efficiency */}
          {efficiencyData.length > 1 && (
            <div className="mt-8">
              <h2 className="mb-4 text-[13px] font-medium">Weekly Study Efficiency</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={efficiencyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: "#71717a" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#71717a" }}
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
                    <Bar dataKey="reviews" fill="#60a5fa" radius={[4, 4, 0, 0]} name="Reviews" />
                    <Bar
                      dataKey="mastery"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      name="Mastery gained"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Best study times */}
          {hourlyData.length > 2 && (
            <div className="mt-8">
              <h2 className="mb-1 text-[13px] font-medium flex items-center gap-2">
                <Clock className="size-4 text-amber-500" />
                Best Study Times
              </h2>
              {bestTimes?.bestHour && (
                <p className="mb-3 text-[12px] text-muted-foreground/60">
                  You perform best around <strong>{bestTimes.bestHour.hour}:00</strong> (
                  {bestTimes.bestHour.accuracy}% accuracy)
                </p>
              )}
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9, fill: "#71717a" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 9, fill: "#71717a" }}
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
                    <Bar dataKey="accuracy" radius={[3, 3, 0, 0]}>
                      {hourlyData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.accuracy >= 80
                              ? "#10b981"
                              : entry.accuracy >= 60
                                ? "#fbbf24"
                                : "#ef4444"
                          }
                        />
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
