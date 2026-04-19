/**
 * Categorized failure reasons for `learning_goals.generation_error`.
 *
 * We never store raw LLM / DB / Supabase error messages on the goal row —
 * those can leak prompts, schema names, and response headers to the client.
 * Instead we map the underlying error to a small enum + attach a short
 * correlation id that the full error was logged with, so support can still
 * trace a report back to the server-side stack trace.
 */

export type GenerationErrorReason =
  | "llm_timeout"
  | "llm_rate_limit"
  | "llm_refused"
  | "db_error"
  | "network_error"
  | "unknown";

const USER_FACING_MESSAGE: Record<GenerationErrorReason, string> = {
  llm_timeout: "The AI service took too long to respond while building your course.",
  llm_rate_limit: "The AI service is temporarily rate-limiting requests. Please try again shortly.",
  llm_refused: "The AI couldn't generate part of the course content safely. Try adjusting your topic.",
  db_error: "A database error interrupted course generation.",
  network_error: "A network error interrupted course generation.",
  unknown: "An unexpected error occurred while generating this course.",
};

export function categorizeGenerationError(err: unknown): GenerationErrorReason {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/timeout|timed out|deadline|ETIMEDOUT/i.test(message)) return "llm_timeout";
  if (/rate[ _-]?limit|\b429\b|too many requests/i.test(message)) return "llm_rate_limit";
  if (/refus|content[ _-]?filter|safety|policy violation/i.test(message)) return "llm_refused";
  if (/ECONN|EAI_AGAIN|fetch failed|network|socket hang up/i.test(message)) return "network_error";
  if (/postgres|drizzle|\brelation\b|column .* does not exist|constraint|syntax error at or near/i.test(message))
    return "db_error";
  return "unknown";
}

/**
 * Serialized form written to `learning_goals.generation_error`:
 * `"<reason>:<8-char-correlation-id>"`. Kept well under the 1000-char cap.
 */
export function formatStoredGenerationError(
  reason: GenerationErrorReason,
  correlationId: string,
): string {
  return `${reason}:${correlationId}`;
}

/**
 * Inverse of `formatStoredGenerationError`. Returns a user-facing message and
 * an optional support code for rendering. Falls back gracefully on any legacy
 * value that wasn't written in the expected `reason:id` shape.
 */
export function parseStoredGenerationError(
  raw: string | null | undefined,
): { message: string; supportCode: string | null } {
  if (!raw) {
    return { message: USER_FACING_MESSAGE.unknown, supportCode: null };
  }
  const sepIdx = raw.indexOf(":");
  if (sepIdx < 0) {
    return { message: USER_FACING_MESSAGE.unknown, supportCode: null };
  }
  const reason = raw.slice(0, sepIdx) as GenerationErrorReason;
  const supportCode = raw.slice(sepIdx + 1) || null;
  const message = USER_FACING_MESSAGE[reason] ?? USER_FACING_MESSAGE.unknown;
  return { message, supportCode };
}
