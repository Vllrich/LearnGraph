"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  X,
  ArrowUp,
  Square,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMentorChat, type ChatMessage } from "@/hooks/use-mentor-chat";
import ReactMarkdown from "react-markdown";

const HIDDEN_PATHS = ["/mentor", "/mentor/chat"];

function extractLearningObjectId(pathname: string): string | null {
  const match = pathname.match(/^\/library\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

export function FloatingMentor() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const learningObjectId = extractLearningObjectId(pathname);
  const contextId = learningObjectId ?? null;
  const { messages, isLoading, sendMessage, stop } = useMentorChat(contextId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isHidden = HIDDEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage]);

  if (isHidden) return null;

  const suggestedPrompts = learningObjectId
    ? [
        "Summarize the key points",
        "What should I focus on?",
        "Quiz me on this",
      ]
    : [
        "What should I study today?",
        "Quiz me on weak areas",
        "Connect my courses",
      ];

  const expandHref = learningObjectId
    ? `/library/${learningObjectId}?tab=chat`
    : "/mentor/chat";

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6 mb-16 lg:mb-0"
          aria-label="Open AI Mentor"
        >
          <Sparkles className="size-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-border/40 bg-background shadow-2xl mb-16 lg:mb-0" style={{ height: "min(520px, calc(100vh - 120px))" }}>
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-2.5">
            <Sparkles className="size-4 text-primary" />
            <span className="flex-1 text-[13px] font-medium">
              AI Mentor
              {learningObjectId && (
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  (this material)
                </span>
              )}
            </span>
            <Link
              href={expandHref}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
              title="Open full mentor"
            >
              <Maximize2 className="size-3.5" />
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="mb-2 flex size-8 items-center justify-center rounded-full bg-muted/40">
                  <Sparkles className="size-4 text-muted-foreground/40" />
                </div>
                <p className="text-[12px] text-muted-foreground/70 mb-3">
                  {learningObjectId
                    ? "Ask me about this material"
                    : "Ask me anything about your courses"}
                </p>
                <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
                  {suggestedPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="rounded-lg border border-border/30 px-3 py-2 text-[11px] text-muted-foreground/70 transition-all hover:border-border/60 hover:text-foreground text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <CompactBubble key={i} message={msg} />
              ))
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border/20 px-3 py-2.5">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a question..."
                rows={1}
                disabled={isLoading}
                className="w-full resize-none rounded-lg border border-border/30 bg-muted/20 px-3 py-2 pr-10 text-[12px] placeholder:text-muted-foreground/35 focus:bg-muted/30 focus:outline-none focus:border-border/50 transition-colors"
                style={{ minHeight: "36px", maxHeight: "80px" }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "36px";
                  t.style.height = `${Math.min(t.scrollHeight, 80)}px`;
                }}
              />
              <div className="absolute bottom-1 right-1.5">
                {isLoading ? (
                  <button
                    onClick={stop}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted transition-colors"
                  >
                    <Square className="size-3" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex size-6 items-center justify-center rounded-md bg-foreground text-background disabled:opacity-20 transition-opacity"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CompactBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-1.5", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/60">
          <Sparkles className="size-2.5 text-foreground/50" />
        </div>
      )}
      <div className={cn("max-w-[85%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-xl px-3 py-1.5",
            isUser ? "bg-foreground text-background" : "bg-transparent"
          )}
        >
          {isUser ? (
            <p className="text-[12px] leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose-sm prose dark:prose-invert max-w-none text-[12px] leading-relaxed [&_p]:mb-1 [&_p:last-child]:mb-0">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block h-3 w-0.5 animate-cursor-blink bg-foreground/50 ml-0.5" />
              )}
            </div>
          )}
        </div>
        {!isUser && !message.isStreaming && message.citations && message.citations.length > 0 && (
          <div className="mt-0.5 flex gap-1 pl-1">
            {message.citations.map((cite, i) => (
              <span
                key={i}
                className="text-[9px] text-primary/50"
                title={cite.content?.slice(0, 100)}
              >
                {cite.pageNumber ? `p.${cite.pageNumber}` : `[${i + 1}]`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
