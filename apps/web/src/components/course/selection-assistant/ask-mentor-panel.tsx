"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/course/markdown-content";
import { cn } from "@/lib/utils";
import { streamSse } from "./sse-client";
import type { SelectionContext } from "./actions";

type AskMentorPanelProps = {
  ctx: SelectionContext;
};

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; streaming?: boolean };

/**
 * Selection-rooted mini chat. The selected text anchors the conversation;
 * every question the user asks is evaluated in that context by
 * `/api/learn/ask`. History is kept locally and sent on each request so the
 * server stays stateless — we can promote this to a durable conversation
 * later by swapping the backend without UI changes.
 */
export function AskMentorPanel({ ctx }: AskMentorPanelProps) {
  // The orchestrator keys this component by selection, so a new selection
  // remounts the panel with a fresh conversation rather than resetting via
  // an effect (see React 19's `set-state-in-effect` rule).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setSending(true);
    setInput("");

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", streaming: true },
    ];
    setMessages(next);

    // Helper: flip the trailing assistant stub back to a non-streaming
    // state. Centralized so every terminal path (done / error / abort)
    // goes through one code path and we don't leak "streaming: true"
    // stubs into later turns' history.
    const stopStreaming = () => {
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.streaming) {
          copy[copy.length - 1] = { ...last, streaming: false };
        }
        return copy;
      });
      setSending(false);
    };

    // Only send non-empty messages as history. An assistant stub with
    // empty content (from a prior aborted / errored turn) would otherwise
    // reach the server and, on Anthropic, trip
    // "messages.N.content: must not be empty". Filtering client-side
    // keeps the server stateless and the wire contract simple.
    const historyForRequest = messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    await streamSse({
      url: "/api/learn/ask",
      body: {
        lessonId: ctx.lessonId,
        goalId: ctx.goalId,
        blockId: ctx.blockId,
        selectedText: ctx.selection.text,
        surroundingText: ctx.selection.surroundingText,
        blockTopic: ctx.blockTopic,
        lessonTitle: ctx.lessonTitle,
        message: trimmed,
        history: historyForRequest,
      },
      signal: controller.signal,
      onChunk: (chunk) => {
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
          }
          return copy;
        });
      },
      onError: (message) => {
        setError(message);
        stopStreaming();
      },
      onDone: stopStreaming,
    });

    // If the request aborted (user resent / closed the sheet) before
    // either onDone or onError fired, clear the spinner too. Without
    // this, a stub would stay "streaming" with empty content until the
    // panel remounts.
    if (controller.signal.aborted) {
      stopStreaming();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        <blockquote className="rounded-lg border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-[13px] italic leading-relaxed text-muted-foreground">
          &ldquo;{truncateForQuote(ctx.selection.text)}&rdquo;
        </blockquote>

        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground/80">
            Ask anything about this selection. The mentor has the surrounding
            context from your lesson.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-sm",
              msg.role === "user"
                ? "ml-6 bg-primary/8 text-foreground"
                : "mr-6 bg-muted/40 text-foreground",
            )}
          >
            {msg.role === "assistant" ? (
              <>
                <MarkdownContent text={msg.content || ""} />
                {msg.streaming && !msg.content && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Thinking…
                  </span>
                )}
                {msg.streaming && msg.content && (
                  <span className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-0.5 animate-pulse bg-foreground/70" />
                )}
              </>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-border/30 pt-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a follow-up…"
          aria-label="Ask a follow-up question about your selection"
          rows={1}
          disabled={sending}
          className="min-h-[38px] flex-1 resize-none rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:border-primary/40 focus:outline-none disabled:opacity-70"
        />
        <Button
          size="sm"
          onClick={() => void send()}
          disabled={!input.trim() || sending}
          className="h-[38px] shrink-0 gap-1.5"
        >
          {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          Send
        </Button>
      </div>
    </div>
  );
}

function truncateForQuote(s: string, max = 240): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}
