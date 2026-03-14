"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  Square,
  Sparkles,
  Copy,
  Lightbulb,
  Route,
  Feather,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMentorChat, type ChatMessage } from "@/hooks/use-mentor-chat";
import { trpc } from "@/trpc/client";
import ReactMarkdown from "react-markdown";

export default function MentorChatPage() {
  const { messages, isLoading, sendMessage, stop, loadConversation } = useMentorChat(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoLoadedRef = useRef(false);

  const { data: conversations } = trpc.mentor.listConversations.useQuery();
  const generalConvos = (conversations ?? []).filter((c) => c.learningObjectId === null);

  const handleLoadConversation = useCallback(async (convId: string) => {
    try {
      const res = await fetch(
        `/api/trpc/mentor.getConversation?input=${encodeURIComponent(JSON.stringify({ id: convId }))}`
      );
      const json = await res.json();
      const conv = json?.result?.data;
      if (conv?.messages) {
        loadConversation(
          conv.messages.map((m: { role: string; content: string; citations?: unknown[] }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            citations: m.citations,
          })),
          convId
        );
      }
    } catch {
      /* silently ignore */
    }
  }, [loadConversation]);

  useEffect(() => {
    if (autoLoadedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conv");
    const prompt = params.get("prompt");
    if (convId || prompt) {
      autoLoadedRef.current = true;
      // Strip params from URL so HMR/remount won't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
      if (convId) {
        void handleLoadConversation(convId);
      } else if (prompt) {
        sendMessage(prompt);
      }
    }
  }, [handleLoadConversation, sendMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage]);

  const suggestedPrompts = [
    "What are the key themes across my courses?",
    "Help me connect concepts between my materials",
    "What should I focus on studying next?",
    "Quiz me on something I've been learning",
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/30 px-3">
        <Link
          href="/mentor"
          className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Sparkles className="size-3.5 shrink-0 text-primary/60" />
          <span className="text-[13px] text-muted-foreground/80">All Courses</span>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: past general conversations */}
        {generalConvos.length > 0 && (
          <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border/20 bg-muted/10">
            <p className="px-3 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Past chats
            </p>
            <div className="flex-1 overflow-y-auto">
              {generalConvos.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleLoadConversation(conv.id)}
                  className="w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                >
                  <p className="truncate text-[12px] font-medium text-foreground/80">
                    {conv.title ?? "Untitled"}
                  </p>
                  {conv.updatedAt && (
                    <p className="text-[10px] text-muted-foreground/40">
                      {new Date(conv.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/40">
                <BookOpen className="size-5 text-muted-foreground/40" />
              </div>
              <p className="text-[13px] font-medium text-foreground/80">
                Chat about all your courses
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/60">
                Ask questions that span across your learning materials.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-md">
                {suggestedPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground/70 transition-all hover:border-border/70 hover:text-foreground text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 px-4 py-4 max-w-3xl w-full mx-auto"
            >
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
              {messages.length > 0 &&
                messages[messages.length - 1].role === "assistant" &&
                !messages[messages.length - 1].isStreaming && (
                  <div className="flex flex-wrap gap-1.5 pl-8">
                    {[
                      { icon: Lightbulb, label: "Give me a hint" },
                      { icon: Route, label: "Walk me through it" },
                      { icon: Feather, label: "Keep it simple" },
                    ].map(({ icon: Icon, label }) => (
                      <button
                        key={label}
                        onClick={() => sendMessage(label)}
                        className="flex items-center gap-1 rounded-full border border-border/30 px-2.5 py-1 text-[11px] text-muted-foreground/60 transition-all hover:border-border/60 hover:text-foreground"
                      >
                        <Icon className="size-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border/20 px-4 py-3 max-w-3xl w-full mx-auto">
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
                placeholder="Ask anything about your courses…"
                rows={1}
                disabled={isLoading}
                className="w-full resize-none rounded-xl border border-border/30 bg-muted/20 px-4 py-2.5 pr-12 text-[13px] placeholder:text-muted-foreground/35 focus:bg-muted/30 focus:outline-none focus:border-border/50 transition-colors"
                style={{ minHeight: "44px", maxHeight: "120px" }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "44px";
                  t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                }}
              />
              <div className="absolute bottom-1.5 right-2">
                {isLoading ? (
                  <button
                    onClick={stop}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-muted transition-colors"
                  >
                    <Square className="size-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-20 transition-opacity"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildCitationHref(cite: { learningObjectId?: string; pageNumber: number | null }) {
  if (!cite.learningObjectId) return null;
  const params = new URLSearchParams({ tab: "fulltext" });
  if (cite.pageNumber) params.set("page", String(cite.pageNumber));
  return `/library/${cite.learningObjectId}?${params}`;
}

function InlineSourceLinks({
  text,
  citations,
}: {
  text: string;
  citations?: ChatMessage["citations"];
}) {
  if (!citations?.length) return <ReactMarkdown>{text}</ReactMarkdown>;

  const citationByPage = new Map<number, (typeof citations)[number]>();
  for (const c of citations) {
    if (c.pageNumber && !citationByPage.has(c.pageNumber)) {
      citationByPage.set(c.pageNumber, c);
    }
  }

  const replaced = text.replace(
    /\[Source:\s*page\s*(\d+)\]/gi,
    (_, pageNum) => {
      const p = Number(pageNum);
      const cite = citationByPage.get(p);
      const href = cite ? buildCitationHref(cite) : null;
      if (href) return `[Source: page ${p}](${href})`;
      return `[Source: page ${p}]`;
    }
  );

  return <ReactMarkdown>{replaced}</ReactMarkdown>;
}

function ChatBubble({ message }: { message: ChatMessage }) {
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
            "inline-block rounded-2xl px-3.5 py-2",
            isUser ? "bg-foreground text-background" : "bg-transparent"
          )}
        >
          {isUser ? (
            <p className="text-[13px] leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose-sm prose dark:prose-invert max-w-none text-[13px] leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:text-foreground/90">
              <InlineSourceLinks text={message.content} citations={message.citations} />
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
              <div className="flex flex-wrap gap-1 ml-1">
                {dedupeCitations(message.citations).map((cite, i) => {
                  const href = buildCitationHref(cite);
                  return href ? (
                    <Link
                      key={i}
                      href={href}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20 transition-colors"
                      title={cite.content?.slice(0, 100)}
                    >
                      {cite.pageNumber ? `p.${cite.pageNumber}` : `[${i + 1}]`}
                    </Link>
                  ) : (
                    <span
                      key={i}
                      className="text-[10px] text-primary/50"
                      title={cite.content?.slice(0, 100)}
                    >
                      {cite.pageNumber ? `p.${cite.pageNumber}` : `[${i + 1}]`}
                    </span>
                  );
                })}
              </div>
            )}
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
