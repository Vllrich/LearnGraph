"use client";

import { Copy, MessageSquare, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-mentor-chat";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      const { toast } = await import("sonner");
      toast.success("Copied to clipboard");
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")} role="listitem">
      {!isUser && (
        <div
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60"
          aria-hidden
        >
          <Sparkles className="size-3 text-foreground/50" />
        </div>
      )}
      <div className={cn("max-w-[88%]", isUser && "text-right")}>
        <div
          className={cn(
            isUser
              ? "inline-flex flex-col gap-1.5 rounded-2xl border border-foreground/8 bg-foreground/[0.04] px-3.5 py-2.5 text-left shadow-sm backdrop-blur-sm"
              : "inline-block rounded-2xl px-3.5 py-2 bg-transparent"
          )}
        >
          {isUser ? (
            <>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="size-3 shrink-0 text-foreground/35" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/35">
                  You
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground/85">{message.content}</p>
            </>
          ) : (
            <div className="prose-sm prose dark:prose-invert max-w-none text-[13px] leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:text-foreground/90">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.isStreaming && (
                <span
                  className="inline-block h-3.5 w-0.5 animate-cursor-blink bg-foreground/50 ml-0.5"
                  aria-label="Typing"
                />
              )}
            </div>
          )}
        </div>
        {!isUser && !message.isStreaming && message.content && (
          <div className="mt-1 flex items-center gap-2 pl-1">
            <button
              onClick={handleCopy}
              className="text-muted-foreground/30 hover:text-foreground/60 transition-colors"
              aria-label="Copy message"
            >
              <Copy className="size-3" />
            </button>
            {message.citations && message.citations.length > 0 && (
              <div className="flex gap-1 ml-1">
                {message.citations.map((cite, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-primary/50"
                    title={cite.content?.slice(0, 100)}
                  >
                    {cite.pageNumber ? `p.${cite.pageNumber}` : `[${i + 1}]`}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
