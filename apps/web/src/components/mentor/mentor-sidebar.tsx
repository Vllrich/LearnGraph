"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowUp,
  Square,
  Maximize2,
  PanelRightClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMentorChat, type ChatMessage } from "@/hooks/use-mentor-chat";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";

const HIDDEN_PATHS = ["/mentor", "/mentor/chat"];

function extractLearningObjectId(pathname: string): string | null {
  const match = pathname.match(/^\/library\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

type MentorSidebarProps = {
  open: boolean;
  onToggle: () => void;
};

export function MentorSidebar({ open, onToggle }: MentorSidebarProps) {
  const pathname = usePathname();
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
    ? ["Summarize the key points", "What should I focus on?", "Quiz me on this"]
    : ["What should I study today?", "Quiz me on weak areas", "Connect my courses"];

  const expandHref = learningObjectId
    ? `/library/${learningObjectId}?tab=chat`
    : "/mentor/chat";

  return (
    <>
      {/* Toggle button — visible when sidebar is closed */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 mb-16 lg:mb-0"
          aria-label="Open AI Mentor"
        >
          <Sparkles className="size-5" />
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed right-0 top-12 bottom-0 z-40 w-[360px] border-l border-border/40 bg-background flex flex-col transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-4 py-3">
          <Sparkles className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">
            AI Mentor
            {learningObjectId && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (this material)
              </span>
            )}
          </span>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Link
                href={expandHref}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
              >
                <Maximize2 className="size-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open full mentor</TooltipContent>
          </Tooltip>
          <button
            onClick={onToggle}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close mentor sidebar"
          >
            <PanelRightClose className="size-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/40">
                <Sparkles className="size-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground/70 mb-4">
                {learningObjectId
                  ? "Ask me about this material"
                  : "Ask me anything about your courses"}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                {suggestedPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-lg border border-border/30 px-3 py-2.5 text-xs text-muted-foreground/70 transition-all hover:border-border/60 hover:text-foreground text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <SidebarBubble key={i} message={msg} onSuggest={sendMessage} />
            ))
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border/20 px-4 py-3">
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
              className="w-full resize-none rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground/35 focus:bg-muted/30 focus:outline-none focus:border-border/50 transition-colors"
              style={{ minHeight: "40px", maxHeight: "100px" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "40px";
                t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
              }}
            />
            <div className="absolute bottom-1.5 right-1.5">
              {isLoading ? (
                <button
                  onClick={stop}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted transition-colors"
                >
                  <Square className="size-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex size-7 items-center justify-center rounded-md bg-foreground text-background disabled:opacity-20 transition-opacity"
                >
                  <ArrowUp className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function buildCitationHref(cite: { learningObjectId?: string; pageNumber: number | null }) {
  if (!cite.learningObjectId) return null;
  const params = new URLSearchParams({ tab: "fulltext" });
  if (cite.pageNumber) params.set("page", String(cite.pageNumber));
  return `/library/${cite.learningObjectId}?${params}`;
}

function parseSuggestions(content: string): { text: string; suggestions: string[] } {
  const match = content.match(/%%SUGGEST%%([\s\S]*?)%%END%%/);
  if (!match) return { text: content, suggestions: [] };
  const suggestions = match[1].split("||").map((s) => s.trim()).filter(Boolean);
  return { text: content.replace(/%%SUGGEST%%[\s\S]*?%%END%%/, "").trimEnd(), suggestions };
}

function SidebarBubble({ message, onSuggest }: { message: ChatMessage; onSuggest: (msg: string) => void }) {
  const isUser = message.role === "user";
  const { text, suggestions } = isUser ? { text: message.content, suggestions: [] } : parseSuggestions(message.content);

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60">
          <Sparkles className="size-3 text-foreground/50" />
        </div>
      )}
      <div className={cn("max-w-[85%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-xl px-3 py-2",
            isUser ? "bg-foreground text-background" : "bg-transparent"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{text}</p>
          ) : (
            <div className="prose-sm prose dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">
              <ReactMarkdown>{text}</ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block h-3.5 w-0.5 animate-cursor-blink bg-foreground/50 ml-0.5" />
              )}
            </div>
          )}
        </div>
        {!isUser && !message.isStreaming && suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                className="rounded-full border border-border/40 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {!isUser && !message.isStreaming && message.citations && message.citations.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 pl-1">
            {dedupeCitations(message.citations).map((cite, i) => {
              const href = buildCitationHref(cite);
              const label = cite.pageNumber ? `p.${cite.pageNumber}` : `[${i + 1}]`;
              const excerpt = cite.content?.slice(0, 120);
              return (
                <Tooltip key={i} delayDuration={300}>
                  <TooltipTrigger asChild>
                    {href ? (
                      <Link
                        href={href}
                        className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20 transition-colors"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="cursor-default text-[10px] text-primary/50">{label}</span>
                    )}
                  </TooltipTrigger>
                  {excerpt && (
                    <TooltipContent side="top" sideOffset={6}>
                      <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">{excerpt}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function dedupeCitations(citations: NonNullable<ChatMessage["citations"]>) {
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = `${c.learningObjectId ?? ""}:${c.pageNumber ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
