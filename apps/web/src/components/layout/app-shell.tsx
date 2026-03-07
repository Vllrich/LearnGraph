"use client";

import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  user: { email?: string; displayName?: string } | null;
};

export function AppShell({ children, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        user={user}
      />
      <main
        className={cn(
          "min-h-screen pb-20 transition-[margin-left] duration-200 ease-in-out lg:pb-0",
          collapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        {children}
      </main>
      <MobileTabBar />
    </TooltipProvider>
  );
}
