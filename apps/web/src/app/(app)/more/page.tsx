"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Target, BarChart3, Globe, LogOut, Download } from "lucide-react";
import Link from "next/link";

const LINKS = [
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/graph", label: "Knowledge Graph", icon: Globe },
  { href: "/export", label: "Export Data", icon: Download },
] as const;

export default function MorePage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <PageContainer>
      <h1 className="text-h1 font-bold tracking-tight">More</h1>

      <nav className="mt-6 space-y-1">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Icon className="size-5 text-muted-foreground" />
              {link.label}
            </Link>
          );
        })}

        <div className="!mt-4 border-t pt-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="size-5" />
            Sign out
          </Button>
        </div>
      </nav>
    </PageContainer>
  );
}
