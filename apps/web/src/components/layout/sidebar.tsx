"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Library,
  MessageCircle,
  Zap,
  Target,
  BarChart3,
  Globe,
  Settings,
  LogOut,
  ChevronLeft,
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
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/mentor", label: "Mentor", icon: MessageCircle },
  { href: "/review", label: "Review", icon: Zap },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/graph", label: "Graph", icon: Globe },
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
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar-background transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand-primary" />
            <span className="text-lg font-bold tracking-tight">LearnGraph</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-7 w-7 rounded-lg bg-brand-primary" />
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn("w-full", !collapsed && "justify-start gap-3")}
          onClick={onToggle}
        >
          <ChevronLeft
            className={cn("size-4 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span className="text-sm">Collapse</span>}
        </Button>

        <Separator />

        <div className={cn("flex items-center gap-3 rounded-lg px-3 py-2", collapsed && "justify-center px-0")}>
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user?.displayName ?? "User"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={handleLogout}>
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}
