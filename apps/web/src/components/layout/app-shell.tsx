"use client";

import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/hooks/use-user";
import { Sidebar } from "./sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { Topbar } from "./topbar";
import { MentorSidebar } from "@/components/mentor/mentor-sidebar";
import { ReadingModeProvider, useReadingMode } from "@/contexts/reading-mode";

type AppShellProps = {
  children: React.ReactNode;
  user: { email?: string; displayName?: string } | null;
};

function AppShellInner({ children, user }: AppShellProps) {
  const [mentorOpen, setMentorOpen] = useState(false);
  const { readingMode } = useReadingMode();

  if (readingMode) {
    return (
      <div className="flex min-h-screen justify-center">
        <main className="w-full min-w-0 max-w-[1200px] overflow-x-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <>
      <Topbar user={user} />
      <Sidebar user={user} />

      <div className="flex min-h-screen pt-12 lg:pl-48">
        <main className={`w-full min-w-0 overflow-x-hidden pb-20 lg:pb-0 transition-all duration-300 ${mentorOpen ? "max-w-[900px] lg:mr-[360px]" : "max-w-[1200px]"}`}>
          {children}
        </main>
        <MentorSidebar open={mentorOpen} onToggle={() => setMentorOpen((v) => !v)} />
      </div>

      <MobileTabBar />
    </>
  );
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <UserProvider user={user}>
      <TooltipProvider delayDuration={200}>
        <ReadingModeProvider>
          <AppShellInner user={user}>{children}</AppShellInner>
        </ReadingModeProvider>
      </TooltipProvider>
    </UserProvider>
  );
}
