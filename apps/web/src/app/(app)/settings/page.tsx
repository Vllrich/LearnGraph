"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Bell, Clock, Shield, Save, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@repo/shared";

export default function SettingsPage() {
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();
  const { data: streak } = trpc.gamification.getStreakAndXp.useQuery();
  const updatePrefs = trpc.user.updatePreferences.useMutation({
    onSuccess: () => toast.success("Settings saved"),
  });
  const updateGoal = trpc.gamification.updateWeeklyGoal.useMutation({
    onSuccess: () => toast.success("Weekly goal updated"),
  });
  const utils = trpc.useUtils();

  const prefs = profile?.preferences as Record<string, unknown> | undefined;
  const notifs = (prefs?.notifications ??
    DEFAULT_NOTIFICATION_PREFERENCES) as typeof DEFAULT_NOTIFICATION_PREFERENCES;

  const [emailReminders, setEmailReminders] = useState<boolean | null>(null);
  const [pushNotifications, setPushNotifications] = useState<boolean | null>(null);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<"daily" | "every_other_day" | "weekly" | null>(null);
  const [smartNudges, setSmartNudges] = useState<boolean | null>(null);
  const [quietStart, setQuietStart] = useState<string | null>(null);
  const [quietEnd, setQuietEnd] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const resolvedWeeklyGoal = streak?.weeklyReviewGoal ?? 50;
  const resolvedDailyBudget = (prefs?.dailyReviewBudget as number) ?? 20;

  const notifsFromPrefs = prefs ? ((prefs.notifications ?? {}) as Record<string, unknown>) : {};
  const resolvedEmailReminders =
    (notifsFromPrefs.emailReminders as boolean) ?? notifs.emailReminders;
  const resolvedPushNotifications =
    (notifsFromPrefs.pushNotifications as boolean) ?? notifs.pushNotifications;
  const resolvedReminderTime = (notifsFromPrefs.reminderTime as string) ?? notifs.reminderTime;
  const resolvedFrequency = (notifsFromPrefs.frequency as typeof frequency) ?? notifs.frequency;
  const resolvedSmartNudges = (notifsFromPrefs.smartNudges as boolean) ?? notifs.smartNudges;
  const resolvedQuietStart = (notifsFromPrefs.quietHoursStart as string) ?? notifs.quietHoursStart;
  const resolvedQuietEnd = (notifsFromPrefs.quietHoursEnd as string) ?? notifs.quietHoursEnd;

  const [weeklyGoal, setWeeklyGoal] = useState(resolvedWeeklyGoal);
  const [dailyBudget, setDailyBudget] = useState(resolvedDailyBudget);

  const effectiveEmail = emailReminders ?? resolvedEmailReminders;
  const effectivePush = pushNotifications ?? resolvedPushNotifications;
  const effectiveReminderTime = reminderTime ?? resolvedReminderTime;
  const effectiveFrequency = frequency ?? resolvedFrequency;
  const effectiveSmartNudges = smartNudges ?? resolvedSmartNudges;
  const effectiveQuietStart = quietStart ?? resolvedQuietStart;
  const effectiveQuietEnd = quietEnd ?? resolvedQuietEnd;

  async function handleSave() {
    await updatePrefs.mutateAsync({
      dailyReviewBudget: dailyBudget,
      notifications: {
        emailReminders: effectiveEmail,
        pushNotifications: effectivePush,
        reminderTime: effectiveReminderTime,
        frequency: effectiveFrequency,
        smartNudges: effectiveSmartNudges,
        quietHoursStart: effectiveQuietStart,
        quietHoursEnd: effectiveQuietEnd,
      },
    });
    await updateGoal.mutateAsync({ goal: weeklyGoal });
    utils.user.getProfile.invalidate();
    utils.gamification.getStreakAndXp.invalidate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Settings</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
          {/* Study Preferences */}
          <section>
            <h2 className="text-[13px] font-medium mb-4 flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Study Preferences
            </h2>
            <div className="space-y-4 rounded-xl border border-border/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Daily review budget</p>
                  <p className="text-[11px] text-muted-foreground/50">
                    Max cards per daily session
                  </p>
                </div>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(Number(e.target.value))}
                  className="w-16 rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-center text-[13px] focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Weekly review goal</p>
                  <p className="text-[11px] text-muted-foreground/50">Target reviews per week</p>
                </div>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                  className="w-16 rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-center text-[13px] focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <h2 className="text-[13px] font-medium mb-4 flex items-center gap-2">
              <Bell className="size-4 text-amber-500" />
              Notifications & Reminders
            </h2>
            <div className="space-y-4 rounded-xl border border-border/30 p-4">
              <ToggleRow
                label="Email reminders"
                description="Daily digest of due reviews"
                checked={effectiveEmail}
                onChange={setEmailReminders}
              />
              <ToggleRow
                label="Push notifications"
                description="Browser push at study time"
                checked={effectivePush}
                onChange={setPushNotifications}
              />
              <ToggleRow
                label="Smart nudges"
                description="Alert when concepts are fading"
                checked={effectiveSmartNudges}
                onChange={setSmartNudges}
              />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Reminder time</p>
                  <p className="text-[11px] text-muted-foreground/50">
                    When to send daily reminders
                  </p>
                </div>
                <input
                  type="time"
                  value={effectiveReminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Frequency</p>
                </div>
                <select
                  value={effectiveFrequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as "daily" | "every_other_day" | "weekly")
                  }
                  className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="every_other_day">Every other day</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          </section>

          {/* Quiet hours */}
          <section>
            <h2 className="text-[13px] font-medium mb-4 flex items-center gap-2">
              <Shield className="size-4 text-violet-500" />
              Quiet Hours
            </h2>
            <div className="rounded-xl border border-border/30 p-4">
              <p className="text-[11px] text-muted-foreground/50 mb-3">
                No notifications during these hours
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={effectiveQuietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                />
                <span className="text-[12px] text-muted-foreground/40">to</span>
                <input
                  type="time"
                  value={effectiveQuietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={updatePrefs.isPending || updateGoal.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-50 transition-opacity"
          >
            {saved ? (
              <>
                <Check className="size-4" />
                Saved
              </>
            ) : updatePrefs.isPending || updateGoal.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Save className="size-4" />
                Save settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground/50">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted/60"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform shadow-sm",
            checked && "translate-x-4"
          )}
        />
      </button>
    </div>
  );
}
