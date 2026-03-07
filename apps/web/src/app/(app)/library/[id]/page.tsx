"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  ArrowLeft,
  ArrowUp,
  FileText,
  Loader2,
  Search,
  Volume2,
  Square,
  Sparkles,
  Youtube,
  PanelRightClose,
  PanelRight,
  Lightbulb,
  Route,
  Feather,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMentorChat, type ChatMessage } from "@/hooks/use-mentor-chat";
import ReactMarkdown from "react-markdown";

type Props = { params: Promise<{ id: string }> };

const PANEL_TABS = ["Chat", "Flashcards", "Quizzes", "Summary", "Concepts"] as const;
type PanelTab = (typeof PANEL_TABS)[number];

export default function ContentDetailPage({ params }: Props) {
  const { id } = use(params);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>("Chat");

  const { data, isLoading, error } = trpc.library.getById.useQuery(
    { id },
    { refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false) },
  );

  if (isLoading) return <LoadingSkeleton />;
  if (error?.data?.code === "NOT_FOUND" || !data) return notFound();

  const isProcessing = data.status === "processing";
  const isFailed = data.status === "failed";
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ─── Top bar ─── */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/30 px-3">
        <Link href="/" className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {data.sourceType === "youtube" ? (
            <Youtube className="size-3.5 shrink-0 text-red-500/80" />
          ) : (
            <FileText className="size-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <span className="truncate text-[13px] text-muted-foreground/80">{data.title}</span>
        </div>
        {isProcessing && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Processing...
          </span>
        )}
        {isFailed && (
          <span className="text-[11px] text-destructive">Failed</span>
        )}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRight className="size-4" />}
        </button>
      </header>

      {/* ─── Main split ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document viewer */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Document toolbar */}
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/20 px-4 text-muted-foreground/50">
            <button className="hover:text-foreground transition-colors"><Search className="size-3.5" /></button>
            <button className="hover:text-foreground transition-colors"><Volume2 className="size-3.5" /></button>
            <div className="mx-auto flex items-center gap-1.5 text-[12px]">
              {data.chunks.length > 0 && (
                <span className="tabular-nums">1 / {data.chunks.length} chunks</span>
              )}
            </div>
          </div>

          {/* Document content */}
          <div className="flex-1 overflow-y-auto">
            {isProcessing && (
              <div className="flex items-center gap-3 bg-amber-50/50 dark:bg-amber-950/10 px-6 py-2.5 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-amber-500" />
                Extracting content — this usually takes 1–3 minutes.
              </div>
            )}
            <ContentViewer data={data} />
          </div>
        </div>

        {/* Vertical divider */}
        {panelOpen && data.status === "ready" && (
          <div className="w-px bg-border/30" />
        )}

        {/* Right: AI Panel */}
        {panelOpen && data.status === "ready" && (
          <div className="flex w-[400px] shrink-0 flex-col">
            {/* Panel tabs */}
            <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border/20 px-4">
              {PANEL_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "relative text-[13px] transition-colors",
                    activeTab === tab
                      ? "font-medium text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {activeTab === tab && (
                      <span className="size-1.5 rounded-full bg-green-500" />
                    )}
                    {tab}
                  </span>
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <TabContent tab={activeTab} data={data} learningObjectId={id} />
              </div>

              {/* Always-visible chat input */}
              <PersistentChatInput learningObjectId={id} onFocusChat={() => setActiveTab("Chat")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Content Viewer ─── */

function ContentViewer({ data }: { data: any }) {
  let keyPoints: string[] = [];
  if (data.summaryKeyPoints) {
    try {
      keyPoints = JSON.parse(data.summaryKeyPoints);
      if (!Array.isArray(keyPoints)) keyPoints = [];
    } catch { keyPoints = []; }
  }

  if (data.status !== "ready") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-muted-foreground/60">Content not yet available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8 font-serif">
      {data.summaryTldr && (
        <p className="mb-6 font-sans text-[15px] leading-relaxed text-foreground/80">
          {data.summaryTldr}
        </p>
      )}

      {keyPoints.length > 0 && (
        <div className="mb-8 border-l-2 border-primary/30 pl-4">
          {keyPoints.map((point, i) => (
            <p key={i} className="mb-1.5 font-sans text-[13px] leading-relaxed text-foreground/70">
              • {point}
            </p>
          ))}
        </div>
      )}

      {data.summaryDeep && (
        <div className="mb-8 space-y-4 text-[15px] leading-[1.8] text-foreground/85">
          {data.summaryDeep.split("\n\n").map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {data.chunks.length > 0 && (
        <div className="space-y-8 border-t border-border/20 pt-8">
          {data.chunks.map((chunk: any) => (
            <div key={chunk.id}>
              {chunk.sectionTitle && (
                <h3 className="mb-2 font-sans text-[14px] font-semibold text-primary/80">
                  {chunk.sectionTitle}
                </h3>
              )}
              <p className="whitespace-pre-wrap text-[14px] leading-[1.75] text-foreground/75">
                {chunk.content}
              </p>
              {chunk.pageNumber != null && (
                <p className="mt-1.5 font-sans text-[11px] text-muted-foreground/40">
                  Page {chunk.pageNumber}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tab Content Router ─── */

function TabContent({
  tab,
  data,
  learningObjectId,
}: {
  tab: PanelTab;
  data: any;
  learningObjectId: string;
}) {
  switch (tab) {
    case "Chat":
      return <ChatTab learningObjectId={learningObjectId} />;
    case "Summary":
      return <SummaryTab data={data} />;
    case "Concepts":
      return <ConceptsTab data={data} />;
    case "Quizzes":
      return <PlaceholderTab label="Quizzes" desc="Quiz generation coming soon. Use Chat to ask quiz questions." />;
    case "Flashcards":
      return <PlaceholderTab label="Flashcards" desc="Flashcard generation coming soon. Use Chat to create flashcards." />;
    default:
      return null;
  }
}

/* ─── Chat Tab ─── */

function ChatTab({ learningObjectId }: { learningObjectId: string }) {
  const { messages, isLoading, sendMessage } = useMentorChat(learningObjectId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Sparkles className="mb-3 size-5 text-muted-foreground/30" />
        <p className="text-[13px] font-medium text-foreground/80">Ask anything about this content</p>
        <p className="mt-1 text-[12px] text-muted-foreground/60">
          Answers are grounded in your uploaded material.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["Explain the main ideas", "Quiz me on this", "Summarize simply"].map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground/70 transition-all hover:border-border/70 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-4 px-4 py-4">
      {messages.map((msg, i) => (
        <ChatBubble key={i} message={msg} />
      ))}
      {/* Quick actions after last assistant message */}
      {messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].isStreaming && (
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
  );
}

/* ─── Summary Tab ─── */

function SummaryTab({ data }: { data: any }) {
  let keyPoints: string[] = [];
  if (data.summaryKeyPoints) {
    try {
      keyPoints = JSON.parse(data.summaryKeyPoints);
      if (!Array.isArray(keyPoints)) keyPoints = [];
    } catch { keyPoints = []; }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {data.summaryTldr && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">TL;DR</p>
          <p className="text-[13px] leading-relaxed text-foreground/85">{data.summaryTldr}</p>
        </div>
      )}
      {keyPoints.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">Key Points</p>
          <ul className="space-y-1.5">
            {keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-foreground/75">
                <span className="mt-[6px] size-1 shrink-0 rounded-full bg-green-500/60" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.summaryDeep && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">Full Summary</p>
          <div className="space-y-2 text-[12px] leading-relaxed text-foreground/70">
            {data.summaryDeep.split("\n\n").map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
      {!data.summaryTldr && !data.summaryDeep && (
        <p className="py-8 text-center text-[12px] text-muted-foreground/50">No summary available.</p>
      )}
    </div>
  );
}

/* ─── Concepts Tab ─── */

function ConceptsTab({ data }: { data: any }) {
  if (data.concepts.length === 0) {
    return <p className="py-8 text-center text-[12px] text-muted-foreground/50">No concepts extracted yet.</p>;
  }

  return (
    <div className="px-4 py-4 space-y-1.5">
      {data.concepts.map((c: any) => (
        <div key={c.id} className="rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foreground/85">{c.displayName}</span>
            {c.difficultyLevel != null && (
              <span className="text-[10px] text-muted-foreground/40">L{c.difficultyLevel}</span>
            )}
          </div>
          {c.definition && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/60">{c.definition}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Placeholder Tab ─── */

function PlaceholderTab({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] font-medium text-foreground/70">{label}</p>
      <p className="mt-1 text-[12px] text-muted-foreground/50">{desc}</p>
    </div>
  );
}

/* ─── Chat Bubble ─── */

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60">
          <Sparkles className="size-3 text-foreground/50" />
        </div>
      )}
      <div className={cn("max-w-[88%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2",
            isUser
              ? "bg-foreground text-background"
              : "bg-transparent",
          )}
        >
          {isUser ? (
            <p className="text-[13px] leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose-sm prose dark:prose-invert max-w-none text-[13px] leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:text-foreground/90">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block h-3.5 w-0.5 animate-cursor-blink bg-foreground/50 ml-0.5" />
              )}
            </div>
          )}
        </div>
        {/* Feedback & citations */}
        {!isUser && !message.isStreaming && message.content && (
          <div className="mt-1 flex items-center gap-2 pl-1">
            <button className="text-muted-foreground/30 hover:text-foreground/60 transition-colors">
              <ThumbsUp className="size-3" />
            </button>
            <button className="text-muted-foreground/30 hover:text-foreground/60 transition-colors">
              <ThumbsDown className="size-3" />
            </button>
            <button className="text-muted-foreground/30 hover:text-foreground/60 transition-colors">
              <Copy className="size-3" />
            </button>
            {message.citations && message.citations.length > 0 && (
              <div className="flex gap-1 ml-1">
                {message.citations.map((cite, i) => (
                  <span key={i} className="text-[10px] text-primary/50">
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

/* ─── Persistent Chat Input (always at bottom of right panel) ─── */

function PersistentChatInput({
  learningObjectId,
  onFocusChat,
}: {
  learningObjectId: string;
  onFocusChat: () => void;
}) {
  const { isLoading, sendMessage, stop } = useMentorChat(learningObjectId);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onFocusChat();
    sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage, onFocusChat]);

  return (
    <div className="border-t border-border/20 px-3 py-2.5">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={onFocusChat}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Learn anything"
          rows={1}
          disabled={isLoading}
          className="w-full resize-none rounded-xl border-0 bg-muted/30 px-3 py-2 pr-10 text-[13px] placeholder:text-muted-foreground/35 focus:bg-muted/40 focus:outline-none transition-colors"
          style={{ minHeight: "36px", maxHeight: "100px" }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "36px";
            t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
          }}
        />
        <div className="absolute bottom-1 right-1.5">
          {isLoading ? (
            <button onClick={stop} className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted">
              <Square className="size-3" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex size-6 items-center justify-center rounded-md bg-foreground text-background disabled:opacity-20 transition-opacity"
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ─── */

function LoadingSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-11 items-center gap-2 border-b border-border/30 px-3">
        <div className="size-4 rounded bg-muted/50 animate-pulse" />
        <div className="h-3.5 w-48 rounded bg-muted/50 animate-pulse" />
      </div>
      <div className="flex flex-1">
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="h-4 w-4/5 rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
            <div className="h-px bg-border/20 my-4" />
            <div className="h-4 w-2/3 rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
          </div>
        </div>
        <div className="w-px bg-border/30" />
        <div className="w-[400px] p-4">
          <div className="flex gap-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3.5 w-14 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
