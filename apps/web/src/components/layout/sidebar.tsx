"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  BookOpen,
  MessageCircle,
  Zap,
  Target,
  BarChart3,
  Globe,
  GraduationCap,
  AlertTriangle,
  Trophy,
  BookMarked,
  Settings,
  Flame,
  Brain,
  Activity,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const NAV_CATEGORIES = [
  {
    label: "Learn",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/library", label: "Library", icon: BookOpen },
      { href: "/mentor", label: "Mentor", icon: MessageCircle },
      { href: "/goals", label: "Goals", icon: Target },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/review", label: "Review", icon: Zap },
      { href: "/exam", label: "Exam", icon: GraduationCap },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/graph", label: "Graph", icon: Globe },
      { href: "/gaps", label: "Gaps", icon: AlertTriangle },
      { href: "/stats", label: "Progress", icon: BarChart3 },
      { href: "/journal", label: "Journal", icon: BookMarked },
      { href: "/achievements", label: "Badges", icon: Trophy },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
] as const;

const TIERS = [
  { min: 0, label: "Newcomer", color: "text-muted-foreground" },
  { min: 5, label: "Explorer", color: "text-blue-500" },
  { min: 20, label: "Scholar", color: "text-violet-500" },
  { min: 50, label: "Expert", color: "text-amber-500" },
  { min: 100, label: "Master", color: "text-emerald-500" },
];

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];

function getTier(concepts: number) {
  return [...TIERS].reverse().find((t) => concepts >= t.min) ?? TIERS[0];
}

function getLevel(concepts: number) {
  return Math.floor(concepts / 5) + 1;
}

type SidebarProps = {
  user: { email?: string; displayName?: string } | null;
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  const { data: stats } = trpc.review.getStats.useQuery();
  const { data: queue } = trpc.review.getDailyQueue.useQuery({ mode: "standard" });
  const { data: streakData } = trpc.gamification.getStreakAndXp.useQuery();
  const { data: gaps } = trpc.gaps.detectGaps.useQuery({});
  const { data: errorLog } = trpc.review.getErrorLog.useQuery();

  const mastery = stats?.mastery;
  const totalConcepts = mastery
    ? [mastery.m0, mastery.m1, mastery.m2, mastery.m3, mastery.m4, mastery.m5].reduce(
        (s, v) => s + Number(v),
        0
      )
    : 0;
  const healthyConcepts = mastery ? Number(mastery.m4) + Number(mastery.m5) : 0;
  const knowledgeHealth =
    totalConcepts > 0 ? Math.round((healthyConcepts / totalConcepts) * 100) : 0;
  const dueCount = (queue?.totalDue ?? 0) + (queue?.totalNew ?? 0);
  const streak = stats?.streak ?? 0;

  const tier = getTier(totalConcepts);
  const level = getLevel(totalConcepts);
  const xpInLevel = totalConcepts % 5;
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Learner";

  return (
    <aside className="fixed left-0 top-12 hidden h-[calc(100vh-3rem)] w-48 shrink-0 flex-col justify-start pt-8 px-4 lg:flex">
      {/* Student info — hover triggers stats popup */}
      <div
        className="relative mb-6"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="cursor-default rounded-lg px-1 py-1 -mx-1 transition-colors hover:bg-muted/30">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn("text-[11px] font-medium", tier.color)}>{tier.label}</span>
            <span className="text-[11px] text-muted-foreground/50">·</span>
            <span className="text-[11px] text-muted-foreground/70">Lv. {level}</span>
          </div>
          {/* XP bar */}
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-border/40">
            <div
              className="h-full rounded-full bg-primary/50 transition-all"
              style={{ width: `${(xpInLevel / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats popup */}
        {hovered && totalConcepts > 0 && (
          <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-border/40 bg-popover shadow-lg ring-1 ring-black/5 dark:ring-white/5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl bg-border/20">
              <Link
                href="/review"
                className="flex flex-col gap-0.5 bg-popover px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3 text-green-500" />
                  <span className="text-[10px] text-muted-foreground/60">Due Today</span>
                </div>
                <span className="text-base font-bold leading-none">{dueCount}</span>
              </Link>

              <div className="flex flex-col gap-0.5 bg-popover px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Flame
                    className={cn(
                      "size-3",
                      streak > 0 ? "text-amber-500" : "text-muted-foreground/30"
                    )}
                  />
                  <span className="text-[10px] text-muted-foreground/60">Streak</span>
                </div>
                <span className="text-base font-bold leading-none">{streak}d</span>
              </div>

              <div className="flex flex-col gap-0.5 bg-popover px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Brain className="size-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground/60">Concepts</span>
                </div>
                <span className="text-base font-bold leading-none">{totalConcepts}</span>
              </div>

              <div className="flex flex-col gap-0.5 bg-popover px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="size-3 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground/60">Health</span>
                </div>
                <span className="text-base font-bold leading-none">{knowledgeHealth}%</span>
                <div className="mt-1 flex gap-0.5">
                  {mastery &&
                    [mastery.m0, mastery.m1, mastery.m2, mastery.m3, mastery.m4, mastery.m5].map(
                      (v, i) => (
                        <div
                          key={i}
                          className="h-0.5 rounded-full"
                          style={{
                            backgroundColor: MASTERY_COLORS[i],
                            width: `${totalConcepts > 0 ? (Number(v) / totalConcepts) * 100 : 0}%`,
                            minWidth: Number(v) > 0 ? "3px" : "0",
                          }}
                        />
                      )
                    )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/20" />

            {/* Quick actions */}
            <div className="p-1.5 space-y-0.5">
              <Link
                href="/review"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors hover:bg-muted/40"
              >
                <Timer className="size-3.5 text-violet-500 shrink-0" />
                <span>Quick 5</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">5-card session</span>
              </Link>

              {(gaps?.totalGaps ?? 0) > 0 && (
                <Link
                  href="/gaps"
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors hover:bg-muted/40"
                >
                  <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                  <span>{gaps!.totalGaps} Gaps</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/50">Fix now</span>
                </Link>
              )}

              <Link
                href="/exam"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors hover:bg-muted/40"
              >
                <GraduationCap className="size-3.5 text-violet-500 shrink-0" />
                <span>Practice Exam</span>
                {(errorLog?.totalErrors ?? 0) > 0 && (
                  <span className="ml-auto text-[10px] text-amber-500">
                    {errorLog!.totalErrors} err
                  </span>
                )}
              </Link>

              <Link
                href="/achievements"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors hover:bg-muted/40"
              >
                <Trophy className="size-3.5 text-amber-500 shrink-0" />
                <span>{(streakData?.totalXp ?? 0).toLocaleString()} XP</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">Badges</span>
              </Link>

              <Link
                href="/journal"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors hover:bg-muted/40"
              >
                <BookMarked className="size-3.5 text-primary shrink-0" />
                <span>Journal</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">Weekly</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="space-y-4" aria-label="Main navigation">
        {NAV_CATEGORIES.map((category) => (
          <div key={category.label}>
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              {category.label}
            </p>
            <div className="space-y-0.5">
              {category.items.map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground/60 hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[17px] shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground/50"
                      )}
                    />
                    {item.label}
                    {isActive && <span className="ml-auto h-1 w-1 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
