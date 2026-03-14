# Notifications & Email Reminders

## Overview

LearnGraph sends email reminders to users when they have concepts due for review. The system is built on three layers:

1. **Settings UI** — users control all preferences in `/settings`
2. **Persistence** — preferences stored in the `users.preferences` JSONB column
3. **Delivery** — a Vercel cron job sends emails via [Brevo](https://brevo.com) every hour

---

## Architecture

```
Vercel Cron (every hour)
    │
    ▼
GET /api/cron/email-reminders
    │
    ├─ Query users with due concepts (nextReviewAt < now)
    │
    └─ For each user:
         ├─ Skip if emailReminders = false
         ├─ Skip if currently in quiet hours (timezone-aware)
         ├─ Skip if frequency hasn't elapsed since lastReminderSentAt
         ├─ Send email via Brevo TransactionalEmailsApi
         └─ Stamp lastReminderSentAt in preferences JSONB
```

---

## Preference Fields

Stored under `users.preferences.notifications` (JSONB):

| Field | Type | Default | Description |
|---|---|---|---|
| `emailReminders` | boolean | `true` | Master toggle for email delivery |
| `pushNotifications` | boolean | `false` | Browser push (UI only, not yet wired) |
| `reminderTime` | `"HH:MM"` | `"09:00"` | Preferred time of day (informational; cron runs hourly) |
| `frequency` | `"daily" \| "every_other_day" \| "weekly"` | `"daily"` | Minimum gap between reminder emails |
| `smartNudges` | boolean | `true` | UI toggle (smart nudge cron not yet implemented) |
| `quietHoursStart` | `"HH:MM"` | `"22:00"` | Start of no-notification window |
| `quietHoursEnd` | `"HH:MM"` | `"07:00"` | End of no-notification window |

Stored at root of `users.preferences`:

| Field | Type | Description |
|---|---|---|
| `lastReminderSentAt` | ISO 8601 string | Timestamp of last sent email — used for frequency gating |

---

## Cron Schedule

Defined in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/email-reminders", "schedule": "0 * * * *" }
  ]
}
```

Runs at the top of every hour. The hourly cadence combined with per-user `reminderTime` preference means emails land within ~1 hour of the user's chosen time (good enough for reminders; for exact-time delivery migrate to QStash — see TODO).

---

## Security

The cron endpoint is protected by a `CRON_SECRET` env var. Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` on Pro plans. For manual testing:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/email-reminders
```

---

## Required Environment Variables

| Variable | Where to get it |
|---|---|
| `BREVO_API_KEY` | [Brevo → Settings → API Keys](https://app.brevo.com/settings/keys/api) |
| `BREVO_SENDER_EMAIL` | A verified sender in [Brevo → Senders & IPs](https://app.brevo.com/senders) |
| `CRON_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Your production domain, e.g. `https://learngraph.app` |

---

## What Is NOT Yet Implemented

| Feature | Notes |
|---|---|
| **Push notifications** | Toggle saves to DB but no service worker or Web Push subscription exists |
| **Smart nudges** | Toggle saves to DB but no cron checks `fsrsRetrievability` thresholds |
| **One-click unsubscribe** | Required for CAN-SPAM / GDPR compliance before public launch |
| **Email tracking** | Open/click events not captured; add Brevo webhook → analytics table |
| **Per-user scheduling accuracy** | Hourly cron is a best-effort approximation; exact-time delivery needs QStash |

See [TODO.md](../TODO.md) for prioritized follow-up tasks.
