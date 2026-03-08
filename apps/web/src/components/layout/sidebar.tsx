"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const { data: stats } = trpc.review.getStats.useQuery();

  const mastery = stats?.mastery;
  const totalConcepts = mastery
    ? [mastery.m0, mastery.m1, mastery.m2, mastery.m3, mastery.m4, mastery.m5].reduce(
        (s, v) => s + Number(v),
        0
      )
    : 0;

  const tier = getTier(totalConcepts);
  const level = getLevel(totalConcepts);
  const xpInLevel = totalConcepts % 5;
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Learner";

  return (
    <aside className="fixed left-0 top-12 hidden h-[calc(100vh-3rem)] w-48 shrink-0 flex-col justify-start pt-8 px-4 lg:flex">
      {/* Student info */}
      <div className="mb-6">
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
