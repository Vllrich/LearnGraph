import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware enforces auth before this layout runs. This guard only
  // handles the race where the session expires between middleware and
  // render, or a misconfigured matcher. Keep it defensive, not primary.
  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        displayName: user.user_metadata?.display_name ?? user.email?.split("@")[0],
      }}
    >
      {children}
    </AppShell>
  );
}
