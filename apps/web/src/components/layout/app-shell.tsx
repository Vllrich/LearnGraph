"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/hooks/use-user";
import { Sidebar } from "./sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { Topbar } from "./topbar";

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

        {/* Sidebar + content centered together as one unit */}
        <div className="mx-auto flex w-full max-w-[900px] pl-12 pt-12">
          <Sidebar user={user} />
          <main className="min-h-screen flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>
        </div>

        <MobileTabBar />
      </TooltipProvider>
    </UserProvider>
  );
}
