import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, learningGoals, courseModules } from "@repo/db";
import { eq, and, asc } from "drizzle-orm";
import {
  checkRateLimit,
  createLogger,
  isProgressiveCourseGenEnabled,
} from "@repo/shared";

const log = createLogger("api/learn/course-events");

// Long-lived SSE connection. Serverless platforms (Vercel Fluid / Node
// runtime) need this high enough to cover a realistic Phase 2 on a large
// course; the stream still closes early the moment the goal reaches a
// terminal state, so in the happy path we're nowhere near this ceiling.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 1_500;
// Heartbeat keeps intermediate proxies (Cloudflare, AWS, etc.) from closing
// an idle connection during long cold stretches. 15s is conservative for
// every proxy we've seen.
const HEARTBEAT_INTERVAL_MS = 15_000;

type ModuleSnapshot = {
  id: string;
  sequenceOrder: number;
  title: string;
  generationStatus: string;
  generationAttempt: number;
  generationError: string | null;
};

type GoalSnapshot = {
  id: string;
  generationStatus: string;
  generationError: string | null;
};

function moduleStateKey(m: ModuleSnapshot): string {
  return `${m.id}|${m.generationStatus}|${m.generationAttempt}`;
}

function sseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push("", "");
  return lines.join("\n");
}

async function loadSnapshot(goalId: string): Promise<{
  goal: GoalSnapshot | null;
  modules: ModuleSnapshot[];
}> {
  const [goal] = await db
    .select({
      id: learningGoals.id,
      generationStatus: learningGoals.generationStatus,
      generationError: learningGoals.generationError,
    })
    .from(learningGoals)
    .where(eq(learningGoals.id, goalId))
    .limit(1);

  const modules = await db
    .select({
      id: courseModules.id,
      sequenceOrder: courseModules.sequenceOrder,
      title: courseModules.title,
      generationStatus: courseModules.generationStatus,
      generationAttempt: courseModules.generationAttempt,
      generationError: courseModules.generationError,
    })
    .from(courseModules)
    .where(eq(courseModules.goalId, goalId))
    .orderBy(asc(courseModules.sequenceOrder));

  return { goal: goal ?? null, modules };
}

/**
 * SSE endpoint streaming course-generation progress events.
 *
 * Events emitted:
 *  - `scaffold`       — initial module list (sent once on connect)
 *  - `module.ready`   — a module's generation_status flipped to `ready`
 *  - `module.failed`  — a module's generation_status flipped to `failed`
 *  - `module.retry`   — a failed module started a new attempt (attempt++)
 *  - `course.complete`— goal reached a terminal status (`ready` or `failed`)
 *  - `heartbeat`      — keep-alive comment every 15s
 *
 * The endpoint is idempotent: reconnects always send a fresh `scaffold` and
 * emit current `ready`/`failed` state for each module, so a client that
 * missed events while offline catches up without relying on server-side
 * replay. `GET /api/trpc/goals.getCourseRoadmap` remains the authoritative
 * snapshot.
 *
 * The stream closes as soon as the goal is in a terminal state AND every
 * module is in a terminal state — no point holding the connection open.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> },
) {
  const { goalId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(goalId)) {
    return new Response("Invalid goalId", { status: 400 });
  }

  // Gate the progressive UI channel entirely behind the feature flag. When
  // disabled, the roadmap falls back to periodic tRPC polling without any
  // connection overhead. `410 Gone` signals the client hook to stop
  // reconnecting rather than `404` (which `EventSource` would keep retrying).
  if (!isProgressiveCourseGenEnabled()) {
    return new Response("Progressive course generation disabled", {
      status: 410,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Rate-limit per user (not per goal) so a rogue client reconnecting in a
  // tight loop can't tie up SSE slots. The generous cap matches roadmap
  // polling patterns (refresh + reopen + prefetch).
  const { allowed, retryAfterMs } = await checkRateLimit("course-events", user.id, {
    maxRequests: 30,
    window: "60 s",
  });
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }

  // Ownership verification — don't leak generation state of a goal the
  // requester doesn't own.
  const [owner] = await db
    .select({ id: learningGoals.id })
    .from(learningGoals)
    .where(and(eq(learningGoals.id, goalId), eq(learningGoals.userId, user.id)))
    .limit(1);
  if (!owner) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  const lastSeenModuleState = new Map<string, string>();
  let lastGoalStatus: string | null = null;
  let eventSeq = 0;
  const nextEventId = () => `${Date.now()}-${++eventSeq}`;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown, id?: string) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(event, data, id)));
        } catch {
          // Controller closed — caller gone. Safe to ignore.
        }
      };

      // Heartbeat so intermediaries don't drop an idle connection during a
      // long wait between state changes. Uses an SSE comment (lines
      // starting with `:` are ignored by the browser EventSource parser).
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Abort handling: close everything as soon as the client disconnects.
      // Without this, the poll loop keeps running until `maxDuration`.
      let aborted = false;
      req.signal.addEventListener("abort", () => {
        aborted = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch { /* already closed */ }
      });

      try {
        // Initial snapshot: always send on connect so a reconnecting client
        // catches up without relying on server-side event replay.
        const initial = await loadSnapshot(goalId);
        if (!initial.goal) {
          enqueue("error", { reason: "not_found" });
          controller.close();
          clearInterval(heartbeat);
          return;
        }

        enqueue(
          "scaffold",
          {
            goalId,
            goalStatus: initial.goal.generationStatus,
            modules: initial.modules.map((m) => ({
              id: m.id,
              sequenceOrder: m.sequenceOrder,
              title: m.title,
              generationStatus: m.generationStatus,
              generationAttempt: m.generationAttempt,
            })),
          },
          nextEventId(),
        );

        // Seed the state tracker so the first poll only emits *changes*.
        // Also emit terminal-state events for any module that's already
        // terminal at connect time — this is what makes reconnect work.
        for (const m of initial.modules) {
          lastSeenModuleState.set(m.id, moduleStateKey(m));
          if (m.generationStatus === "ready") {
            enqueue("module.ready", moduleEventPayload(m), nextEventId());
          } else if (m.generationStatus === "failed") {
            enqueue("module.failed", moduleEventPayload(m), nextEventId());
          }
        }
        lastGoalStatus = initial.goal.generationStatus;

        if (isTerminal(initial)) {
          enqueue(
            "course.complete",
            { goalStatus: initial.goal.generationStatus },
            nextEventId(),
          );
          controller.close();
          clearInterval(heartbeat);
          return;
        }

        // Poll loop. Stops on abort or when the course hits a terminal state.
        while (!aborted) {
          await sleep(POLL_INTERVAL_MS);
          if (aborted) break;

          let snap: Awaited<ReturnType<typeof loadSnapshot>>;
          try {
            snap = await loadSnapshot(goalId);
          } catch (err) {
            log.warn("poll_snapshot_failed", {
              goalId,
              error: err instanceof Error ? err.message : String(err),
            });
            continue;
          }
          if (!snap.goal) break;

          // Emit per-module transitions.
          for (const m of snap.modules) {
            const key = moduleStateKey(m);
            const prev = lastSeenModuleState.get(m.id);
            if (prev === key) continue;
            lastSeenModuleState.set(m.id, key);

            if (m.generationStatus === "ready") {
              enqueue("module.ready", moduleEventPayload(m), nextEventId());
            } else if (m.generationStatus === "failed") {
              enqueue("module.failed", moduleEventPayload(m), nextEventId());
            } else if (m.generationStatus === "generating") {
              // Only surface `module.retry` when the attempt counter moved
              // past 1 — the initial `generating` transition isn't user-
              // facing news, whereas a retry *is* (spinner should flip back).
              if (m.generationAttempt > 1) {
                enqueue("module.retry", moduleEventPayload(m), nextEventId());
              }
            }
          }

          if (snap.goal.generationStatus !== lastGoalStatus) {
            lastGoalStatus = snap.goal.generationStatus;
          }

          if (isTerminal(snap)) {
            enqueue(
              "course.complete",
              { goalStatus: snap.goal.generationStatus },
              nextEventId(),
            );
            break;
          }
        }
      } catch (err) {
        log.error("stream_failed", {
          goalId,
          error: err instanceof Error ? err.message : String(err),
        });
        try {
          enqueue("error", { reason: "stream_failed" });
        } catch { /* already closed */ }
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable Nginx buffering (and anything else following this hint).
      "X-Accel-Buffering": "no",
    },
  });
}

function moduleEventPayload(m: ModuleSnapshot) {
  return {
    id: m.id,
    sequenceOrder: m.sequenceOrder,
    title: m.title,
    generationStatus: m.generationStatus,
    generationAttempt: m.generationAttempt,
    generationError: m.generationError,
  };
}

function isTerminal(snap: {
  goal: GoalSnapshot | null;
  modules: ModuleSnapshot[];
}): boolean {
  if (!snap.goal) return true;
  if (snap.goal.generationStatus === "generating") return false;
  return snap.modules.every(
    (m) => m.generationStatus === "ready" || m.generationStatus === "failed",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
