"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

import { MarkdownContent } from "@/components/course/markdown-content";
import { cn } from "@/lib/utils";
import { streamSse } from "./sse-client";
import type { SelectionContext } from "./actions";

type ExplainPanelProps = {
  ctx: SelectionContext;
};

/**
 * Streams an AI-generated, lesson-aware explanation of the user's selection.
 * One POST → one SSE stream → render as Markdown. The active stream is
 * aborted when the context changes or the panel unmounts (e.g. the sheet
 * closes).
 */
export function ExplainPanel({ ctx }: ExplainPanelProps) {
  // The orchestrator keys this component by selection, so a new selection
  // remounts with fresh state rather than resetting inside an effect. That
  // keeps the effect body free of state resets and aligns with React 19's
  // `set-state-in-effect` rule.
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"streaming" | "done" | "error">("streaming");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void streamSse({
      url: "/api/learn/explain",
      body: {
        lessonId: ctx.lessonId,
        goalId: ctx.goalId,
        blockId: ctx.blockId,
        selectedText: ctx.selection.text,
        surroundingText: ctx.selection.surroundingText,
        blockTopic: ctx.blockTopic,
        lessonTitle: ctx.lessonTitle,
      },
      signal: controller.signal,
      onChunk: (chunk) => setText((prev) => prev + chunk),
      onError: (message) => {
        setError(message);
        setStatus("error");
      },
      onDone: () => setStatus((s) => (s === "error" ? s : "done")),
    });
    return () => controller.abort();
  }, [ctx.lessonId, ctx.blockId, ctx.goalId, ctx.selection.text, ctx.selection.surroundingText, ctx.blockTopic, ctx.lessonTitle]);

  // Auto-scroll to keep the newest text in view as it streams. The actual
  // overflow container is the SheetBody (or whichever scrollable ancestor
  // the panel is hosted inside), not this flex container itself — so we
  // walk up until we find a node that actually scrolls. Silently no-ops
  // if there isn't one.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const scroller = findScrollableAncestor(node);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [text]);

  return (
    <div ref={scrollRef} className="flex flex-col gap-3">
      <blockquote className="rounded-lg border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-[13px] italic leading-relaxed text-muted-foreground">
        &ldquo;{truncateForQuote(ctx.selection.text)}&rdquo;
      </blockquote>

      {status === "streaming" && !text && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Looking this up…</span>
        </div>
      )}

      {text && (
        <div>
          <MarkdownContent text={text} />
          {status === "streaming" && (
            <span className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-0.5 animate-pulse bg-foreground/70" />
          )}
        </div>
      )}

      {status === "error" && error && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
          )}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

function truncateForQuote(s: string, max = 240): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

/**
 * Find the closest ancestor that is an actual scroll container — i.e. whose
 * computed `overflow-y` is `auto`/`scroll` AND whose scrollHeight already
 * exceeds its clientHeight. We tolerate either direction; the caller only
 * writes `scrollTop`.
 */
function findScrollableAncestor(node: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === "auto" || overflowY === "scroll";
    if (isScrollable && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return null;
}
