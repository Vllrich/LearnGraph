import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import {
  findStuckModules,
  claimStuckModuleForSweep,
  regenerateSingleModule,
} from "@repo/ai";
import {
  createLogger,
  getRedisClient,
  isProgressiveCourseGenEnabled,
} from "@repo/shared";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const log = createLogger("cron.sweep-stuck-modules");

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Threshold (minutes) after which a `pending`/`generating` module is
 * considered stuck. Must be comfortably longer than the longest realistic
 * `runSingleModuleJob` duration under retries. 10 minutes is ~2× the p99 of
 * observed module latencies today; tune via env if generation slows.
 */
const STUCK_THRESHOLD_MINUTES = Math.max(
  1,
  Number(process.env.COURSE_STUCK_THRESHOLD_MINUTES ?? 10),
);

/**
 * Hard cap on how many modules a single sweep tick can re-dispatch. Keeps
 * one cron invocation from spending an entire OpenAI RPM budget on
 * recoveries.
 */
const SWEEP_MAX_BATCH = Math.max(
  1,
  Number(process.env.COURSE_SWEEP_MAX_BATCH ?? 20),
);

/**
 * Retry eligibility: once a module has been attempted this many times
 * (counting both original dispatch attempts and sweep re-dispatches), the
 * sweeper stops touching it and operators must decide what to do. This
 * keeps a deterministically-broken module from consuming token budget
 * indefinitely.
 */
const MAX_SWEEP_ATTEMPTS = Math.max(
  1,
  Number(process.env.COURSE_SWEEP_MAX_ATTEMPTS ?? 5),
);

/**
 * Redis-level advisory lock around the whole sweeper tick.
 *
 * **Redis is optional here.** The DB-level atomic claim in
 * `claimStuckModuleForSweep` is the real correctness gate — two overlapping
 * sweeps cannot both succeed on the same module because the second
 * `UPDATE ... WHERE status IN (...) AND age > cutoff` matches zero rows.
 *
 * The Redis lock is purely an efficiency optimization: when two cron
 * invocations overlap (e.g. a delayed tick colliding with the next
 * scheduled one), one of them short-circuits before doing any DB work.
 * When Redis is unavailable we fall through and rely on the DB claim,
 * which is slightly more chatty but functionally identical.
 */
const SWEEP_LOCK_KEY = "sweep:course-modules:lock";
const SWEEP_LOCK_TTL_SEC = 55; // shorter than the cron cadence (5m)

async function acquireTickLock(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true; // no Redis → rely on DB-level claim only
  try {
    const res = await redis.set(SWEEP_LOCK_KEY, randomUUID(), {
      nx: true,
      ex: SWEEP_LOCK_TTL_SEC,
    });
    return res === "OK";
  } catch (err) {
    // Redis outage should never block the sweeper — the DB claim is the
    // real correctness gate. Log and proceed.
    log.warn("tick_lock.redis_error", { err: String(err) });
    return true;
  }
}

/**
 * Cron-triggered stuck-module recovery.
 *
 * Every tick:
 *   1. ACK the schedule & auth check.
 *   2. Return fast if the progressive flag is disabled (we still want the
 *      route deployed + scheduled so flipping the flag immediately
 *      activates the sweeper without a redeploy).
 *   3. Acquire a short advisory lock (best-effort Redis).
 *   4. Find stuck modules (`findStuckModules`).
 *   5. For each: atomic DB claim (`claimStuckModuleForSweep`), then
 *      fire-and-forget `regenerateSingleModule` on the Node runtime via
 *      `after()` so the cron response doesn't block on regeneration.
 *   6. Emit a structured summary and a per-module log line.
 *
 * Invariants:
 *   - A module can only be claimed by one sweep invocation (DB UPDATE is
 *     atomic; overlapping callers see affected rows = 0 for that module).
 *   - Modules in `ready` or modules with `generation_attempt >= MAX` are
 *     never touched.
 *   - Goal-level status is recomputed inside `regenerateSingleModule` so
 *     the roadmap converges on truth once the retry settles.
 */
export async function GET(request: Request) {
  const correlationId = randomUUID().slice(0, 8);

  // Auth: Vercel cron passes the secret as a Bearer token. Also accepted
  // for manual ops invocations (`curl -H "authorization: Bearer ..."`).
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    log.warn("auth.reject", { correlationId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("tick.start", {
    correlationId,
    flagEnabled: isProgressiveCourseGenEnabled(),
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
    maxBatch: SWEEP_MAX_BATCH,
    maxAttempts: MAX_SWEEP_ATTEMPTS,
  });

  if (!isProgressiveCourseGenEnabled()) {
    log.info("tick.skip_flag_disabled", { correlationId });
    return NextResponse.json({
      ok: true,
      skipped: "flag_disabled",
      correlationId,
    });
  }

  const lockAcquired = await acquireTickLock();
  if (!lockAcquired) {
    log.info("tick.skip_lock_held", { correlationId });
    return NextResponse.json({
      ok: true,
      skipped: "lock_held",
      correlationId,
    });
  }

  let found = 0;
  let reenqueued = 0;
  let skippedClaim = 0;
  let errors = 0;

  try {
    const stuck = await findStuckModules({
      staleMinutes: STUCK_THRESHOLD_MINUTES,
      limit: SWEEP_MAX_BATCH,
      maxAttempts: MAX_SWEEP_ATTEMPTS,
    });
    found = stuck.length;

    for (const row of stuck) {
      const modCorrId = `${correlationId}:${row.moduleId.slice(0, 8)}`;
      const stuckForMs = row.generationStartedAt
        ? Date.now() - row.generationStartedAt.getTime()
        : null;

      try {
        const claimed = await claimStuckModuleForSweep({
          moduleId: row.moduleId,
          staleMinutes: STUCK_THRESHOLD_MINUTES,
          maxAttempts: MAX_SWEEP_ATTEMPTS,
        });

        if (!claimed) {
          // Another sweep already re-dispatched this module, or the row
          // transitioned to `ready`/exhausted retries between read and
          // claim. Harmless; just skip.
          skippedClaim++;
          log.info("sweep.skip_not_claimed", {
            correlationId: modCorrId,
            goalId: row.goalId,
            moduleId: row.moduleId,
            sequenceOrder: row.sequenceOrder,
            priorStatus: row.generationStatus,
            priorAttempt: row.generationAttempt,
          });
          continue;
        }

        reenqueued++;
        log.info("sweep.reenqueue", {
          correlationId: modCorrId,
          goalId: row.goalId,
          moduleId: row.moduleId,
          moduleIdx: row.sequenceOrder,
          priorStatus: row.generationStatus,
          priorAttempt: row.generationAttempt,
          nextAttempt: row.generationAttempt + 1,
          stuckForMs,
          retryCause:
            row.generationStatus === "pending"
              ? "never_started"
              : "stalled_in_flight",
        });

        // Fire the retry in `after()` so the cron HTTP response isn't
        // blocked on regeneration. `regenerateSingleModule` is itself
        // idempotent + internally retried, and will recompute the
        // goal-level status on completion.
        after(async () => {
          try {
            const result = await regenerateSingleModule({
              goalId: row.goalId,
              moduleId: row.moduleId,
            });
            log.info("sweep.resolve", {
              correlationId: modCorrId,
              goalId: row.goalId,
              moduleId: row.moduleId,
              moduleIdx: row.sequenceOrder,
              result,
            });
          } catch (err) {
            log.error("sweep.resolve_error", {
              correlationId: modCorrId,
              goalId: row.goalId,
              moduleId: row.moduleId,
              moduleIdx: row.sequenceOrder,
              err: String(err),
            });
          }
        });
      } catch (err) {
        errors++;
        log.error("sweep.unexpected_error", {
          correlationId: modCorrId,
          goalId: row.goalId,
          moduleId: row.moduleId,
          err: String(err),
        });
      }
    }
  } finally {
    log.info("tick.end", {
      correlationId,
      found,
      reenqueued,
      skippedClaim,
      errors,
    });
  }

  return NextResponse.json({
    ok: true,
    correlationId,
    found,
    reenqueued,
    skippedClaim,
    errors,
  });
}
