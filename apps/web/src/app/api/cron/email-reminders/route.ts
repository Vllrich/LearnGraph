import { NextResponse } from "next/server";
import { BrevoClient } from "@getbrevo/brevo";
import { db } from "@repo/db";
import { users, userConceptState } from "@repo/db";
import { and, lt, isNotNull, sql } from "drizzle-orm";
import type { NotificationPreferences } from "@repo/shared";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? "noreply@learngraph.app";
const SENDER_NAME = "LearnGraph";
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://learngraph.app";

function isInQuietHours(quietStart: string, quietEnd: string, timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const localTime = formatter.format(now); // "HH:MM"

    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const nowMin = toMinutes(localTime);
    const startMin = toMinutes(quietStart);
    const endMin = toMinutes(quietEnd);

    // Handles overnight ranges (e.g. 22:00 – 07:00)
    if (startMin > endMin) return nowMin >= startMin || nowMin < endMin;
    return nowMin >= startMin && nowMin < endMin;
  } catch {
    return false;
  }
}

function shouldSendToday(
  frequency: NotificationPreferences["frequency"],
  lastSentAt: Date | null
): boolean {
  if (!lastSentAt) return true;
  const now = Date.now();
  const elapsed = now - lastSentAt.getTime();
  const DAY = 86_400_000;
  if (frequency === "daily") return elapsed >= DAY;
  if (frequency === "every_other_day") return elapsed >= 2 * DAY;
  if (frequency === "weekly") return elapsed >= 7 * DAY;
  return true;
}

function buildEmailHtml(
  displayName: string | null,
  dueCount: number,
  appUrl: string
): string {
  const name = displayName ?? "there";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden">
        <tr>
          <td style="padding:32px 32px 0">
            <p style="margin:0;font-size:20px;font-weight:600;color:#f5f5f5">LearnGraph</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px">
            <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#f5f5f5">
              Hey ${name}, time to review! 🧠
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.6">
              You have <strong style="color:#f5f5f5">${dueCount} concept${dueCount !== 1 ? "s" : ""}</strong> due for review today.
              Keep your streak alive and reinforce what you've learned.
            </p>
            <a href="${appUrl}/review"
               style="display:inline-block;background:#f5f5f5;color:#0f0f0f;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px">
              Start Review Session →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #2a2a2a">
            <p style="margin:0;font-size:12px;color:#555;line-height:1.5">
              You're receiving this because you enabled email reminders in
              <a href="${appUrl}/settings" style="color:#888">your settings</a>.
              <br>To stop these emails, turn off reminders in your settings.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY ?? "" });

  // Fetch all users who have due concepts right now
  const dueUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      timezone: users.timezone,
      preferences: users.preferences,
      dueCount: sql<number>`count(${userConceptState.id})::int`,
    })
    .from(users)
    .innerJoin(
      userConceptState,
      and(
        sql`${userConceptState.userId} = ${users.id}`,
        lt(userConceptState.nextReviewAt, new Date()),
        isNotNull(userConceptState.nextReviewAt)
      )
    )
    .groupBy(users.id, users.email, users.displayName, users.timezone, users.preferences)
    .having(sql`count(${userConceptState.id}) > 0`);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of dueUsers) {
    try {
      const prefs = user.preferences as Record<string, unknown> | null;
      const notifs = (prefs?.notifications ?? {}) as Partial<NotificationPreferences>;

      const emailEnabled = notifs.emailReminders ?? true;
      if (!emailEnabled) { skipped++; continue; }

      const timezone = user.timezone ?? "UTC";
      const quietStart = notifs.quietHoursStart ?? "22:00";
      const quietEnd = notifs.quietHoursEnd ?? "07:00";
      if (isInQuietHours(quietStart, quietEnd, timezone)) { skipped++; continue; }

      const frequency = notifs.frequency ?? "daily";
      const lastSent = (prefs?.lastReminderSentAt as string | null)
        ? new Date(prefs!.lastReminderSentAt as string)
        : null;
      if (!shouldSendToday(frequency, lastSent)) { skipped++; continue; }

      await brevo.transactionalEmails.sendTransacEmail({
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email: user.email, name: user.displayName ?? undefined }],
        subject: `${user.dueCount} concept${user.dueCount !== 1 ? "s" : ""} due for review`,
        htmlContent: buildEmailHtml(user.displayName, user.dueCount, APP_URL),
      });

      // Track last sent so frequency is respected
      await db
        .update(users)
        .set({
          preferences: sql`jsonb_set(
            coalesce(${users.preferences}, '{}'::jsonb),
            '{lastReminderSentAt}',
            ${JSON.stringify(new Date().toISOString())}::jsonb
          )`,
          updatedAt: new Date(),
        })
        .where(sql`${users.id} = ${user.id}`);

      sent++;
    } catch (err) {
      errors.push(`${user.email}: ${String(err)}`);
    }
  }

  return NextResponse.json({ sent, skipped, errors: errors.length ? errors : undefined });
}
