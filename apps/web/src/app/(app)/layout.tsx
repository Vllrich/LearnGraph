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
