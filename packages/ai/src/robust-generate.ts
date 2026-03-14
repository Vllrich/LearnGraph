const MAX_PARSE_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Wraps a `generateObject` call with retry logic for parse failures.
 * API errors already use the SDK's built-in maxRetries; this catches
 * "No object generated" / parse errors that the SDK doesn't retry.
 */
export async function withParseRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isParseError =
        msg.includes("could not parse") ||
        msg.includes("No object generated") ||
        msg.includes("JSON");

      if (!isParseError || attempt === MAX_PARSE_RETRIES) throw err;

      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  throw lastError;
}
