"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Zap, Globe, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/review", label: "Review", icon: Zap },
  { href: "/graph", label: "Graph", icon: Globe },
  { href: "/stats", label: "Progress", icon: BarChart3 },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden"
      aria-label="Mobile navigation"
    >
      {TABS.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
