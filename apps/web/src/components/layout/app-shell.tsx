"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/hooks/use-user";
import { Sidebar } from "./sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { Topbar } from "./topbar";
import { FloatingMentor } from "@/components/mentor/floating-mentor";

type AppShellProps = {
  children: React.ReactNode;
  user: { email?: string; displayName?: string } | null;
};

export function AppShell({ children, user }: AppShellProps) {
  return (
    <UserProvider user={user}>
      <TooltipProvider delayDuration={200}>
        {/* Fixed top bar: logo left, user right */}
        <Topbar user={user} />

        {/* Sidebar fixed to left; content centered independently */}
        <Sidebar user={user} />
        <main className="mx-auto w-full max-w-[1200px] min-h-screen min-w-0 overflow-x-hidden pb-20 pt-12 lg:pl-48 lg:pb-0">
          {children}
        </main>

        <MobileTabBar />
        <FloatingMentor />
      </TooltipProvider>
    </UserProvider>
  );
}
