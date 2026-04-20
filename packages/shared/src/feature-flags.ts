/**
 * Feature flags for LearnGraph.
 *
 * Conventions:
 *   - Server-only env vars are plain names (e.g. `PROGRESSIVE_COURSE_GENERATION`).
 *   - Client-readable mirrors must be prefixed with `NEXT_PUBLIC_` so Next.js
 *     inlines them at build time.
 *   - Production default is OFF. Dev default is ON so local developers get
 *     the new flow by default without extra env config.
 *
 * The helper lives in `@repo/shared` so both `apps/web` server routes and
 * client components can import it — on the client `process.env` only exposes
 * `NEXT_PUBLIC_*` vars, so the helper falls through to that mirror.
 */

function readBooleanEnv(value: string | undefined): boolean | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return undefined;
}

/**
 * Whether progressive course generation (module-1-first, SSE lifecycle,
 * auto-redirect into lesson 1, per-module retry UI) is enabled.
 *
 * Default: ON in non-production, OFF in production until we have rolled the
 * flag on for all tenants. Controlled by:
 *   - `PROGRESSIVE_COURSE_GENERATION` (server-side route handlers + workers)
 *   - `NEXT_PUBLIC_PROGRESSIVE_COURSE_GENERATION` (client-side UI gating)
 *
 * If the server flag is set, it wins. If only the public mirror is set, it
 * wins. If neither is set, we fall back to the env-based default.
 */
export function isProgressiveCourseGenEnabled(): boolean {
  const server = readBooleanEnv(process.env.PROGRESSIVE_COURSE_GENERATION);
  if (server !== undefined) return server;

  const client = readBooleanEnv(
    process.env.NEXT_PUBLIC_PROGRESSIVE_COURSE_GENERATION,
  );
  if (client !== undefined) return client;

  return process.env.NODE_ENV !== "production";
}
