"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Zap,
  BarChart3,
  Globe,
  LogOut,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/review", label: "Review", icon: Zap },
  { href: "/graph", label: "Graph", icon: Globe },
  { href: "/stats", label: "Progress", icon: BarChart3 },
] as const;

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  user: { email?: string; displayName?: string } | null;
};

export function Sidebar({ collapsed, onToggle, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ??
    user?.email?.slice(0, 2).toUpperCase() ??
    "?";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/40 bg-background transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-12 items-center border-b border-border/40 px-3", collapsed && "justify-center px-0")}>
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md gradient-brand">
              <Sparkles className="size-3 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight">LearnGraph</span>
          </Link>
        ) : (
          <Link href="/" className="flex size-6 items-center justify-center rounded-md gradient-brand">
            <Sparkles className="size-3 text-white" />
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-primary/8 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/40 p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full h-8", !collapsed ? "justify-start gap-2 px-2.5" : "px-0")}
          onClick={onToggle}
        >
          <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span className="text-xs text-muted-foreground">Collapse</span>}
        </Button>

        <div className={cn("mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2", collapsed && "justify-center px-0")}>
          <Avatar className="size-6">
            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-[12px] font-medium">{user?.displayName ?? "User"}</p>
            </div>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="size-6 p-0" onClick={handleLogout}>
                  <LogOut className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Sign out</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}
