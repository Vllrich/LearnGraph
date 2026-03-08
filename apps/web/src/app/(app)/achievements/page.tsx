"use client";

import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Flame, Star, Zap } from "lucide-react";
import Link from "next/link";

const LEVEL_TIERS = [
  { min: 0, label: "Newcomer", color: "text-zinc-500" },
  { min: 500, label: "Explorer", color: "text-blue-500" },
  { min: 2000, label: "Scholar", color: "text-violet-500" },
  { min: 5000, label: "Expert", color: "text-amber-500" },
  { min: 10000, label: "Grandmaster", color: "text-emerald-500" },
];

function getXpTier(xp: number) {
  return [...LEVEL_TIERS].reverse().find((t) => xp >= t.min) ?? LEVEL_TIERS[0];
}

function getXpLevel(xp: number) {
  return Math.floor(xp / 100) + 1;
}

export default function AchievementsPage() {
  const { data: streak, isLoading: streakLoading } = trpc.gamification.getStreakAndXp.useQuery();
  const { data: achievements, isLoading: achievementsLoading } =
    trpc.gamification.getAchievements.useQuery();

  const isLoading = streakLoading || achievementsLoading;
  const xp = streak?.totalXp ?? 0;
  const tier = getXpTier(xp);
  const level = getXpLevel(xp);
  const xpInLevel = xp % 100;
  const unlockedCount = achievements?.filter((a) => a.unlocked).length ?? 0;
  const totalCount = achievements?.length ?? 0;
  const weeklyProgress = streak
    ? Math.min(
        100,
        Math.round(((streak.weeklyReviewsDone ?? 0) / (streak.weeklyReviewGoal ?? 50)) * 100)
      )
    : 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Achievements</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Hero stats */}
          <div className="mb-8 rounded-2xl border border-border/30 bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Star className={cn("size-5", tier.color)} />
                  <span className={cn("text-sm font-bold", tier.color)}>{tier.label}</span>
                  <span className="text-[12px] text-muted-foreground/50">Level {level}</span>
                </div>
                <p className="mt-1 text-3xl font-bold tabular-nums">{xp.toLocaleString()} XP</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Flame className="size-5 text-amber-500" />
                  <span className="text-2xl font-bold">{streak?.currentStreak ?? 0}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/50">day streak</p>
                {(streak?.longestStreak ?? 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground/30">
                    Best: {streak?.longestStreak}d
                  </p>
                )}
              </div>
            </div>

            {/* XP progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/50 mb-1">
                <span>Level {level}</span>
                <span>{xpInLevel}/100 XP</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${xpInLevel}%` }}
                />
              </div>
            </div>

            {/* Weekly goal */}
            <div className="mt-4 rounded-xl border border-border/20 bg-muted/10 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3 text-green-500" />
                  <span className="text-[11px] font-medium">Weekly Goal</span>
                </div>
                <span className="text-[11px] text-muted-foreground/50">
                  {streak?.weeklyReviewsDone ?? 0} / {streak?.weeklyReviewGoal ?? 50} reviews
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    weeklyProgress >= 100 ? "bg-green-500" : "bg-primary"
                  )}
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
            </div>

            {/* Streak shield */}
            {(streak?.freezesAvailable ?? 0) > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground/40">
                🛡️ 1 streak shield available this week
              </p>
            )}
          </div>

          {/* Badges grid */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">
              Badges ({unlockedCount}/{totalCount})
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievements?.map((a) => (
              <div
                key={a.key}
                className={cn(
                  "rounded-xl border p-4 transition-all",
                  a.unlocked
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/20 bg-muted/10 opacity-50"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{a.icon}</span>
                  {a.unlocked && (
                    <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-600">
                      Unlocked
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[13px] font-medium">{a.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/50">{a.description}</p>
                <p className="mt-1 text-[10px] text-primary/70">+{a.xp} XP</p>
                {a.unlockedAt && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/30">
                    {new Date(a.unlockedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
