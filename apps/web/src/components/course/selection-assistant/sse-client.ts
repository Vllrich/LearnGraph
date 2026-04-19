/**
 * Minimal SSE reader that mirrors the `data: {type:"text", text}` framing used
 * by `/api/learn/session-v2`. Kept in one place so the Explain and Ask panels
 * (and any future streaming surface) don't re-implement it.
 *
 * The caller owns the AbortController — aborting cleanly stops the read loop
 * and the `onChunk`/`onError` callbacks are guaranteed not to fire after
 * abort. Throws are only used for genuine network failures; typed error events
 * from the server arrive via `onError`.
 */
export type SseTextEvent = { type: "text"; text: string };
export type SseErrorEvent = { type: "error"; error: string };
export type SseDoneEvent = { type: "done" };
export type SseEvent = SseTextEvent | SseErrorEvent | SseDoneEvent;

export type StreamSseOptions = {
  url: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  onChunk: (text: string) => void;
  onError?: (message: string) => void;
  /**
   * Called exactly once when the stream completes successfully (not on
   * abort, not on error). Letting callers wire cleanup here keeps setState
   * out of the surrounding `useEffect` body — all state mutation happens
   * inside event callbacks, which plays well with React 19's effect rules.
   */
  onDone?: () => void;
};

export async function streamSse(opts: StreamSseOptions): Promise<void> {
  const { url, body, signal, onChunk, onError, onDone } = opts;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) return;
    const message = err instanceof Error ? err.message : "Network error";
    onError?.(message);
    return;
  }

  if (!res.ok || !res.body) {
    if (signal.aborted) return;
    // Try to surface the server's JSON error message when present.
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.clone().json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON body — keep generic message */
    }
    onError?.(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // TEMP diag: wire-level visibility into SSE framing. Remove once the
  // Explain/Ask pipeline has been QA'd end-to-end.
  const diag = process.env.NODE_ENV !== "production";
  let chunkCount = 0;
  let byteCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) break;
      const decoded = decoder.decode(value, { stream: true });
      byteCount += decoded.length;
      buffer += decoded;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as SseEvent;
          if (signal.aborted) return;
          if (event.type === "text") {
            chunkCount++;
            onChunk(event.text);
          } else if (event.type === "error") {
            if (diag) console.warn("[streamSse] server error", event.error);
            onError?.(event.error);
          }
        } catch (parseErr) {
          if (diag) console.warn("[streamSse] bad frame", line, parseErr);
        }
      }
    }
    if (diag) {
      console.info(
        `[streamSse] ${url} ended: aborted=${signal.aborted} chunks=${chunkCount} bytes=${byteCount}`,
      );
    }
    if (!signal.aborted) onDone?.();
  } catch (err) {
    if (signal.aborted || (err as Error)?.name === "AbortError") return;
    const message = err instanceof Error ? err.message : "Stream failed";
    onError?.(message);
  } finally {
    // Release the reader's lock so the response body can be GC'd immediately.
    // The underlying connection is already closed when we reach `done` or
    // bail on abort; we're just freeing the per-stream handle.
    try {
      reader.releaseLock();
    } catch {
      /* reader may already be released on some error paths */
    }
  }
}
