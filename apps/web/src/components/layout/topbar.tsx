"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type TopbarProps = {
  user: { email?: string; displayName?: string } | null;
};

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

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
    <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-border/30 bg-background/80 px-5 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/Logo.svg"
          alt="LearnGraph"
          width={24}
          height={24}
          className="size-6 rounded-md"
        />
        <span className="text-sm font-semibold tracking-tight">LearnGraph</span>
      </Link>

      {/* Right: theme + user */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0" onClick={handleLogout}>
              <LogOut className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Sign out</TooltipContent>
        </Tooltip>

        <Avatar className="size-7">
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
