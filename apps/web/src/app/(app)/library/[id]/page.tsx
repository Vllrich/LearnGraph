"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { trpc } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";
import type { LucideIcon } from "lucide-react";
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
  Copy,
  Globe,
  Presentation,
  FileAudio,
  Image as ImageIcon,
  FileType2,
  MessageSquare,
  Layers,
  CircleHelp,
  AlignLeft,
  GitFork,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMentorChat, type ChatMessage } from "@/hooks/use-mentor-chat";
import ReactMarkdown from "react-markdown";

type RouterOutput = inferRouterOutputs<AppRouter>;
type ContentData = NonNullable<RouterOutput["library"]["getById"]>;

type Props = { params: Promise<{ id: string }> };

const PANEL_TABS = [
  { id: "Chat" as const, icon: MessageSquare, label: "Chat" },
  { id: "Flashcards" as const, icon: Layers, label: "Flashcards" },
  { id: "Quizzes" as const, icon: CircleHelp, label: "Quiz" },
  { id: "Summary" as const, icon: AlignLeft, label: "Summary" },
  { id: "Concepts" as const, icon: Lightbulb, label: "Concepts" },
  { id: "Related" as const, icon: GitFork, label: "Related" },
];
type PanelTab = (typeof PANEL_TABS)[number]["id"];
type SelectionActionType = "explain" | "chat" | "quiz" | "flashcard" | "copy" | "read";
type MentorChatHandlers = ReturnType<typeof useMentorChat>;

export default function ContentDetailPage({ params }: Props) {
  const { id } = use(params);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>("Chat");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mentorChat = useMentorChat(id);

  const handleSelectionAction = useCallback(
    (action: SelectionActionType, text: string) => {
      switch (action) {
        case "explain":
          setPanelOpen(true);
          setActiveTab("Chat");
          mentorChat.sendMessage(`Explain this passage in simple terms:\n\n"${text}"`);
          break;
        case "chat":
          setPanelOpen(true);
          setActiveTab("Chat");
          mentorChat.sendMessage(`Regarding this passage:\n\n"${text}"`);
          break;
        case "quiz":
          setPanelOpen(true);
          setActiveTab("Chat");
          mentorChat.sendMessage(
            `Create a short quiz (2-3 questions, mix of MCQ and short answer) to test understanding of this passage. After each question, wait for my response before revealing the answer.\n\n"${text}"`
          );
          break;
        case "flashcard":
          setPanelOpen(true);
          setActiveTab("Chat");
          mentorChat.sendMessage(
            `Create 2-3 concise flashcards (front: question, back: answer) from this passage:\n\n"${text}"`
          );
          break;
        case "copy":
          navigator.clipboard.writeText(text).catch(() => {});
          import("sonner").then(({ toast }) => toast.success("Copied to clipboard"));
          break;
        case "read":
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
          break;
      }
    },
    [mentorChat]
  );

  const { data, isLoading, error } = trpc.library.getById.useQuery(
    { id },
    { refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false) }
  );
  const initMutation = trpc.review.initConceptStates.useMutation();
  const initRef = useRef(false);
  const toastRef = useRef(false);
  const panelScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelScrollRef.current) panelScrollRef.current.scrollTop = 0;
  }, [activeTab]);

  useEffect(() => {
    if (data?.status === "ready" && data.concepts.length > 0 && !initRef.current) {
      initRef.current = true;
      initMutation.mutate({ learningObjectId: id });
    }
  }, [data?.status, data?.concepts.length, id, initMutation]);

  useEffect(() => {
    if (data?.status === "ready" && !toastRef.current) {
      const meta = data.metadata as Record<string, unknown> | null;
      const connections = Number(meta?.crossSourceConnections ?? 0);
      if (connections > 0) {
        toastRef.current = true;
        import("sonner").then(({ toast }) => {
          toast.info(
            `${connections} connection${connections > 1 ? "s" : ""} found with your other materials`,
            { description: "Check the Related tab to explore." }
          );
        });
      }
    }
  }, [data?.status, data?.metadata]);

  if (isLoading) return <LoadingSkeleton />;
  if (error?.data?.code === "NOT_FOUND" || !data) return notFound();

  const isProcessing = data.status === "processing";
  const isFailed = data.status === "failed";
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ─── Top bar ─── */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/30 px-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {data.sourceType === "youtube" ? (
            <Youtube className="size-3.5 shrink-0 text-red-500/80" />
          ) : data.sourceType === "url" ? (
            <Globe className="size-3.5 shrink-0 text-blue-500/80" />
          ) : data.sourceType === "pptx" ? (
            <Presentation className="size-3.5 shrink-0 text-orange-500/80" />
          ) : data.sourceType === "docx" ? (
            <FileType2 className="size-3.5 shrink-0 text-blue-600/80" />
          ) : data.sourceType === "audio" ? (
            <FileAudio className="size-3.5 shrink-0 text-purple-500/80" />
          ) : data.sourceType === "image" ? (
            <ImageIcon className="size-3.5 shrink-0 text-green-500/80" />
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
        {isFailed && <span className="text-[11px] text-destructive">Failed</span>}
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
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                "hover:text-foreground transition-colors",
                searchOpen && "text-foreground"
              )}
            >
              <Search className="size-3.5" />
            </button>
            <button
              onClick={() => {
                if (isSpeaking) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                } else {
                  const fullText = data.chunks.map((c) => c.content).join("\n\n");
                  if (!fullText) return;
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(fullText);
                  utterance.rate = 0.95;
                  utterance.onend = () => setIsSpeaking(false);
                  utterance.onerror = () => setIsSpeaking(false);
                  window.speechSynthesis.speak(utterance);
                  setIsSpeaking(true);
                }
              }}
              className={cn(
                "hover:text-foreground transition-colors",
                isSpeaking && "text-orange-500"
              )}
            >
              {isSpeaking ? (
                <span className="flex items-center gap-1">
                  <Square className="size-3" />
                  <span className="flex items-end gap-px h-3">
                    {[0, 150, 75, 225].map((delay) => (
                      <span
                        key={delay}
                        className="w-0.5 rounded-full bg-orange-500 animate-[soundbar_0.8s_ease-in-out_infinite]"
                        style={{ animationDelay: `${delay}ms`, height: "40%" }}
                      />
                    ))}
                  </span>
                </span>
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </button>
            <div className="mx-auto flex items-center gap-1.5 text-[12px]">
              {data.chunks.length > 0 && (
                <span className="tabular-nums">1 / {data.chunks.length} chunks</span>
              )}
            </div>
          </div>

          {/* Search bar */}
          {searchOpen && <DocSearchBar data={data} />}

          {/* Document content */}
          <div className="flex-1 overflow-y-auto">
            {isProcessing && (
              <div className="flex items-center gap-3 bg-amber-50/50 dark:bg-amber-950/10 px-6 py-2.5 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-amber-500" />
                Extracting content — this usually takes 1–3 minutes.
              </div>
            )}
            <ContentViewer data={data} onSelectionAction={handleSelectionAction} />
          </div>
        </div>

        {/* Vertical divider */}
        {panelOpen && data.status === "ready" && <div className="w-px bg-border/30" />}

        {/* Right: AI Panel */}
        {panelOpen && data.status === "ready" && (
          <div className="flex w-[520px] shrink-0 flex-col">
            {/* Panel tabs */}
            <div className="flex h-10 shrink-0 items-center border-b border-border/20 px-2 gap-0.5">
              {PANEL_TABS.map(({ id: tab, icon: TabIcon, label }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    activeTab === tab
                      ? "bg-muted/60 text-foreground"
                      : "text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  <TabIcon className="size-3.5 shrink-0" />
                  {label}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-green-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div ref={panelScrollRef} className="flex-1 overflow-y-auto">
                <TabContent
                  tab={activeTab}
                  data={data}
                  learningObjectId={id}
                  mentorChat={mentorChat}
                />
              </div>

              {/* Always-visible chat input */}
              <PersistentChatInput
                learningObjectId={id}
                onFocusChat={() => setActiveTab("Chat")}
                mentorChat={mentorChat}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Document Search Bar ─── */

function DocSearchBar({ data }: { data: ContentData }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const contentEl = document.querySelector<HTMLElement>("[data-doc-content]");
    if (!contentEl) return;

    // Remove previous highlights
    contentEl.querySelectorAll("mark[data-doc-search]").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
      parent.normalize();
    });

    if (query.length < 2) return;

    const lowerQuery = query.toLowerCase();
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    let firstMark: HTMLElement | null = null;
    for (const node of textNodes) {
      const text = node.textContent ?? "";
      const lowerText = text.toLowerCase();
      let idx = lowerText.indexOf(lowerQuery);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let last = 0;
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.setAttribute("data-doc-search", "");
        mark.style.cssText = "background:hsl(48 96% 53%/0.4);color:inherit;border-radius:2px;";
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        if (!firstMark) firstMark = mark;
        last = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }

    firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [query]);

  const matchCount = (() => {
    if (query.length < 2) return 0;
    const fullText = data.chunks
      .map((c) => c.content)
      .join(" ")
      .toLowerCase();
    const q = query.toLowerCase();
    let count = 0,
      pos = 0;
    let idx = fullText.indexOf(q, pos);
    while (idx !== -1) {
      count++;
      pos = idx + q.length;
      idx = fullText.indexOf(q, pos);
    }
    return count;
  })();

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/20 px-4">
      <Search className="size-3 text-muted-foreground/40" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search in document..."
        className="flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground/30 focus:outline-none"
      />
      {query.length >= 2 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/40">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
      )}
    </div>
  );
}

/* ─── Selection Menu ─── */

const SELECTION_ACTIONS: Array<{
  id: SelectionActionType;
  icon: LucideIcon;
  label: string;
  color: string;
}> = [
  { id: "explain", icon: Sparkles, label: "Explain", color: "text-amber-500" },
  { id: "chat", icon: MessageSquare, label: "Chat", color: "text-blue-500" },
  { id: "quiz", icon: CircleHelp, label: "Quiz", color: "text-violet-500" },
  { id: "flashcard", icon: Layers, label: "Flashcards", color: "text-emerald-500" },
  { id: "copy", icon: Copy, label: "Copy", color: "text-muted-foreground" },
  { id: "read", icon: Volume2, label: "Read aloud", color: "text-rose-400" },
];

function SelectionMenu({
  position,
  onAction,
  onClose,
}: {
  position: { top: number; left: number };
  onAction: (action: SelectionActionType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedLeft, setAdjustedLeft] = useState(position.left);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const menuWidth = ref.current.offsetWidth;
    const halfMenu = menuWidth / 2;
    const clamped = Math.max(
      halfMenu + 8,
      Math.min(position.left, window.innerWidth - halfMenu - 8)
    );
    setAdjustedLeft(clamped);
    requestAnimationFrame(() => setVisible(true));
  }, [position.left]);

  const above = position.top > 64;

  return (
    <div
      ref={ref}
      style={{
        top: above ? position.top - 48 : position.top + 12,
        left: adjustedLeft,
        transform: "translateX(-50%)",
      }}
      className={cn(
        "pointer-events-auto fixed z-50 flex items-center gap-0.5 rounded-xl border border-border/40 bg-popover px-1 py-0.5 shadow-2xl shadow-black/15 ring-1 ring-black/3 backdrop-blur-xl transition-all duration-150",
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      )}
    >
      {SELECTION_ACTIONS.map(({ id, icon: Icon, label, color }) => (
        <button
          key={id}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => {
            onAction(id);
            onClose();
          }}
          className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground/70 transition-all hover:bg-accent hover:text-foreground"
        >
          <Icon
            className={cn("size-3.5 shrink-0 transition-colors group-hover:scale-110", color)}
          />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Content Viewer ─── */

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function ContentViewer({
  data,
  onSelectionAction,
}: {
  data: ContentData;
  onSelectionAction: (action: SelectionActionType, text: string) => void;
}) {
  const [selectionMenu, setSelectionMenu] = useState<{
    text: string;
    position: { top: number; left: number };
  } | null>(null);

  const handlePointerUp = useCallback(() => {
    // Small defer so the browser finalises the selection range
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (text.length < 2) {
        setSelectionMenu(null);
        return;
      }
      if (!sel || sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectionMenu({
        text,
        position: { top: rect.top, left: rect.left + rect.width / 2 },
      });
    }, 10);
  }, []);

  const handleAction = useCallback(
    (action: SelectionActionType) => {
      onSelectionAction(action, selectionMenu?.text ?? "");
    },
    [onSelectionAction, selectionMenu]
  );

  let keyPoints: string[] = [];
  if (data.summaryKeyPoints) {
    try {
      keyPoints = JSON.parse(data.summaryKeyPoints);
      if (!Array.isArray(keyPoints)) keyPoints = [];
    } catch {
      keyPoints = [];
    }
  }

  if (data.status !== "ready") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-muted-foreground/60">Content not yet available.</p>
      </div>
    );
  }

  const videoId =
    data.sourceType === "youtube" && data.sourceUrl ? extractVideoId(data.sourceUrl) : null;

  return (
    <div className="relative" data-doc-content onPointerUp={handlePointerUp}>
      {selectionMenu && (
        <SelectionMenu
          position={selectionMenu.position}
          onAction={handleAction}
          onClose={() => setSelectionMenu(null)}
        />
      )}
      <div className="mx-auto max-w-3xl px-8 py-8 font-serif">
        {videoId && (
          <div className="mb-6 aspect-video w-full overflow-hidden rounded-xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={data.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          </div>
        )}

        {data.summaryTldr && (
          <p className="mb-6 font-sans text-[15px] leading-relaxed text-foreground/80">
            {data.summaryTldr}
          </p>
        )}

        {keyPoints.length > 0 && (
          <div className="mb-8 border-l-2 border-primary/30 pl-4">
            {keyPoints.map((point, i) => (
              <p
                key={i}
                className="mb-1.5 font-sans text-[13px] leading-relaxed text-foreground/70"
              >
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
            {data.chunks.map((chunk) => (
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
    </div>
  );
}

/* ─── Tab Content Router ─── */

function TabContent({
  tab,
  data,
  learningObjectId,
  mentorChat,
}: {
  tab: PanelTab;
  data: ContentData;
  learningObjectId: string;
  mentorChat: MentorChatHandlers;
}) {
  switch (tab) {
    case "Chat":
      return <ChatTab learningObjectId={learningObjectId} mentorChat={mentorChat} />;
    case "Summary":
      return <SummaryTab data={data} />;
    case "Concepts":
      return <ConceptsTab data={data} />;
    case "Quizzes":
      return <QuizzesTab learningObjectId={learningObjectId} />;
    case "Related":
      return <RelatedContentTab learningObjectId={learningObjectId} />;
    case "Flashcards":
      return <FlashcardsTab data={data} learningObjectId={learningObjectId} />;
    default:
      return null;
  }
}

/* ─── Chat Tab ─── */

function ChatTab({
  learningObjectId,
  mentorChat,
}: {
  learningObjectId: string;
  mentorChat: MentorChatHandlers;
}) {
  const { messages, sendMessage, loadConversation } = mentorChat;
  const { data: conversations } = trpc.mentor.listConversations.useQuery();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  const relevantConvos = (conversations ?? []).filter(
    (c) => c.learningObjectId === learningObjectId
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleLoadConversation = async (convId: string) => {
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
        setShowHistory(false);
      }
    } catch {
      /* silently ignore */
    }
  };

  if (messages.length === 0 && !showHistory) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Sparkles className="mb-3 size-5 text-muted-foreground/30" />
        <p className="text-[13px] font-medium text-foreground/80">
          Ask anything about this content
        </p>
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
        {relevantConvos.length > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            className="mt-4 text-[11px] text-primary/60 hover:text-primary transition-colors"
          >
            View past conversations ({relevantConvos.length})
          </button>
        )}
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="px-4 py-4 space-y-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-medium text-foreground/80">Past conversations</p>
          <button
            onClick={() => setShowHistory(false)}
            className="text-[11px] text-muted-foreground/50 hover:text-foreground"
          >
            Back
          </button>
        </div>
        {relevantConvos.map((conv) => (
          <button
            key={conv.id}
            onClick={() => handleLoadConversation(conv.id)}
            className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
          >
            <p className="truncate text-[12px] font-medium">{conv.title}</p>
            <p className="text-[10px] text-muted-foreground/40">
              {conv.updatedAt
                ? new Date(conv.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : ""}
            </p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-4 px-4 py-4">
      {relevantConvos.length > 0 && (
        <button
          onClick={() => setShowHistory(true)}
          className="mb-2 text-[10px] text-primary/50 hover:text-primary transition-colors"
        >
          View past conversations
        </button>
      )}
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
  );
}

/* ─── Summary Tab ─── */

function SummaryTab({ data }: { data: ContentData }) {
  let keyPoints: string[] = [];
  if (data.summaryKeyPoints) {
    try {
      keyPoints = JSON.parse(data.summaryKeyPoints);
      if (!Array.isArray(keyPoints)) keyPoints = [];
    } catch {
      keyPoints = [];
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {data.summaryTldr && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            TL;DR
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/85">{data.summaryTldr}</p>
        </div>
      )}
      {keyPoints.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Key Points
          </p>
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
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Full Summary
          </p>
          <div className="space-y-2 text-[12px] leading-relaxed text-foreground/70">
            {data.summaryDeep.split("\n\n").map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
      {!data.summaryTldr && !data.summaryDeep && (
        <p className="py-8 text-center text-[12px] text-muted-foreground/50">
          No summary available.
        </p>
      )}
    </div>
  );
}

/* ─── Concepts Tab ─── */

function ConceptsTab({ data }: { data: ContentData }) {
  if (data.concepts.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-muted-foreground/50">
        No concepts extracted yet.
      </p>
    );
  }

  return (
    <div className="px-4 py-4 space-y-1.5">
      {data.concepts.map((c) => (
        <div key={c.id} className="rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foreground/85">{c.displayName}</span>
            {c.difficultyLevel != null && (
              <span className="text-[10px] text-muted-foreground/40">L{c.difficultyLevel}</span>
            )}
          </div>
          {c.definition && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/60">
              {c.definition}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Quizzes Tab ─── */

function QuizzesTab({ learningObjectId }: { learningObjectId: string }) {
  const { data: questionList, isLoading } = trpc.library.getQuestions.useQuery({
    learningObjectId,
  });
  const submitMutation = trpc.review.submitReview.useMutation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!questionList || questionList.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[13px] font-medium text-foreground/70">No quizzes yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">
          Quizzes are auto-generated during ingestion. They&apos;ll appear here once ready.
        </p>
      </div>
    );
  }

  const q = questionList[currentIdx];
  if (!q) return null;

  const options = Array.isArray(q.options) ? (q.options as string[]) : [];
  const isCorrect = selected === q.correctAnswer;

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    const conceptId = q.conceptIds?.[0];
    if (!conceptId) return;

    await submitMutation.mutateAsync({
      conceptId,
      rating,
      questionId: q.id,
      answerText: selected ?? undefined,
      isCorrect,
    });

    setSelected(null);
    setRevealed(false);
    setCurrentIdx((i) => (i + 1) % questionList.length);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/40 tabular-nums">
          {currentIdx + 1} / {questionList.length}
        </span>
        {q.difficulty && (
          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground/50">
            Difficulty {q.difficulty}/5
          </span>
        )}
      </div>

      <p className="text-[13px] font-medium leading-relaxed">{q.questionText}</p>

      {q.questionType === "mcq" && options.length > 0 ? (
        <div className="space-y-1.5">
          {options.map((opt, i) => {
            const isSel = selected === opt;
            const isRight = revealed && opt === q.correctAnswer;
            const isWrong = revealed && isSel && !isRight;
            return (
              <button
                key={i}
                onClick={() => !revealed && setSelected(opt)}
                disabled={revealed}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-[12px] transition-all",
                  isRight
                    ? "border-green-500/50 bg-green-500/5 text-green-600 dark:text-green-400"
                    : isWrong
                      ? "border-red-500/50 bg-red-500/5 text-red-600 dark:text-red-400"
                      : isSel
                        ? "border-foreground/30 bg-muted/30"
                        : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                )}
              >
                <span className="mr-1.5 text-muted-foreground/40">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          disabled={revealed}
          placeholder="Type your answer..."
          className="w-full rounded-lg border border-border/30 bg-transparent px-3 py-2 text-[12px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
        />
      )}

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          disabled={!selected}
          className="w-full rounded-lg bg-foreground py-2 text-[12px] font-medium text-background disabled:opacity-20 transition-opacity"
        >
          Check Answer
        </button>
      ) : (
        <div className="space-y-3">
          {q.explanation && (
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                {q.explanation}
              </p>
            </div>
          )}
          <p className="text-center text-[10px] text-muted-foreground/40">
            How well did you know this?
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { rating: 1 as const, label: "Again", color: "text-red-500" },
              { rating: 2 as const, label: "Hard", color: "text-orange-500" },
              { rating: 3 as const, label: "Good", color: "text-blue-500" },
              { rating: 4 as const, label: "Easy", color: "text-green-500" },
            ].map(({ rating, label, color }) => (
              <button
                key={rating}
                onClick={() => handleRate(rating)}
                disabled={submitMutation.isPending}
                className="rounded-lg border border-border/30 py-1.5 text-center transition-all hover:border-border/60 hover:bg-muted/20"
              >
                <p className={cn("text-[11px] font-medium", color)}>{label}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Related Content Tab (Cross-Source Connections) ─── */

function RelatedContentTab({ learningObjectId }: { learningObjectId: string }) {
  const { data: related, isLoading } = trpc.library.relatedContent.useQuery({ learningObjectId });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!related || related.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[13px] font-medium text-foreground/70">No connections yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">
          Upload more content to discover cross-source knowledge connections.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-1.5">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Shared Concepts
      </p>
      {related.map((lo) => {
        const Icon =
          lo.sourceType === "youtube"
            ? Youtube
            : lo.sourceType === "url"
              ? Globe
              : lo.sourceType === "pptx"
                ? Presentation
                : lo.sourceType === "audio"
                  ? FileAudio
                  : lo.sourceType === "image"
                    ? ImageIcon
                    : lo.sourceType === "docx"
                      ? FileType2
                      : FileText;
        return (
          <Link
            key={lo.id}
            href={`/library/${lo.id}`}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground/85">{lo.title}</p>
              {lo.summaryTldr && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/60">
                  {lo.summaryTldr}
                </p>
              )}
              <p className="mt-1 text-[10px] text-primary/60">
                {lo.sharedConceptCount} shared concept{lo.sharedConceptCount !== 1 ? "s" : ""}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Flashcards Tab ─── */

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

function FlashcardsTab({
  data,
  learningObjectId,
}: {
  data: ContentData;
  learningObjectId: string;
}) {
  const submitMutation = trpc.review.submitReview.useMutation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<Record<number, boolean>>({});

  const cards = data.concepts.filter((c) => c.definition);

  if (cards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Layers className="mb-3 size-5 text-muted-foreground/30" />
        <p className="text-[13px] font-medium text-foreground/70">No flashcards yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">
          Flashcards are generated from extracted concepts. Check back once ingestion completes.
        </p>
      </div>
    );
  }

  const card = cards[currentIdx]!;
  const totalRated = Object.keys(rated).length;
  const progress = Math.round((totalRated / cards.length) * 100);

  const goTo = (idx: number) => {
    setCurrentIdx(idx);
    setFlipped(false);
  };

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    setRated((prev) => ({ ...prev, [currentIdx]: true }));
    try {
      await submitMutation.mutateAsync({
        conceptId: card.id,
        rating,
        isCorrect: rating >= 3,
      });
    } catch {
      /* non-blocking */
    }
    const next = currentIdx + 1 < cards.length ? currentIdx + 1 : currentIdx;
    goTo(next);
  };

  const ratingButtons = [
    {
      rating: 1 as const,
      label: "Again",
      color: "text-red-500",
      border: "hover:border-red-500/40",
    },
    {
      rating: 2 as const,
      label: "Hard",
      color: "text-orange-500",
      border: "hover:border-orange-500/40",
    },
    {
      rating: 3 as const,
      label: "Good",
      color: "text-blue-500",
      border: "hover:border-blue-500/40",
    },
    {
      rating: 4 as const,
      label: "Easy",
      color: "text-green-500",
      border: "hover:border-green-500/40",
    },
  ];

  const allDone = totalRated === cards.length;

  if (allDone) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="mb-3 size-6 text-green-500/70" />
        <p className="text-[14px] font-semibold text-foreground/85">Session complete!</p>
        <p className="mt-1 text-[12px] text-muted-foreground/60">
          You reviewed all {cards.length} flashcards.
        </p>
        <button
          onClick={() => {
            setRated({});
            goTo(0);
          }}
          className="mt-4 flex items-center gap-1.5 rounded-full border border-border/40 px-4 py-1.5 text-[12px] text-muted-foreground/70 transition-all hover:border-border/70 hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Study again
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 py-4">
      {/* Progress bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500/60 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground/40">
          {totalRated}/{cards.length}
        </span>
      </div>

      {/* Card */}
      <div
        className="relative flex-1 cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative h-full w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-muted/20 px-6 py-8"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Concept
            </span>
            <p className="text-center text-[18px] font-semibold leading-snug text-foreground/90">
              {card.displayName}
            </p>
            {card.difficultyLevel != null && (
              <span className="mt-4 rounded-full bg-muted/50 px-2.5 py-0.5 text-[10px] text-muted-foreground/50">
                {DIFFICULTY_LABEL[card.difficultyLevel] ?? `Level ${card.difficultyLevel}`}
              </span>
            )}
            <p className="mt-6 text-[11px] text-muted-foreground/35">Tap to reveal definition</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-card px-6 py-8"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Definition
            </span>
            <p className="text-center text-[13px] leading-relaxed text-foreground/80">
              {card.definition}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {flipped ? (
          <>
            <p className="text-center text-[10px] text-muted-foreground/40">
              How well did you know this?
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {ratingButtons.map(({ rating, label, color, border }) => (
                <button
                  key={rating}
                  onClick={() => handleRate(rating)}
                  disabled={submitMutation.isPending}
                  className={cn(
                    "rounded-xl border border-border/30 py-2 text-center transition-all hover:bg-muted/20",
                    border
                  )}
                >
                  <p className={cn("text-[11px] font-semibold", color)}>{label}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full rounded-xl bg-foreground py-2.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Reveal
          </button>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goTo(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground disabled:opacity-20"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </button>
          <div className="flex gap-1">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "size-1.5 rounded-full transition-all",
                  i === currentIdx
                    ? "bg-foreground/70 scale-125"
                    : rated[i]
                      ? "bg-green-500/50"
                      : "bg-border/50 hover:bg-border/80"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => goTo(Math.min(cards.length - 1, currentIdx + 1))}
            disabled={currentIdx === cards.length - 1}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground disabled:opacity-20"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
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

/* ─── Persistent Chat Input (always at bottom of right panel) ─── */

function PersistentChatInput({
  onFocusChat,
  mentorChat,
}: {
  learningObjectId: string;
  onFocusChat: () => void;
  mentorChat: MentorChatHandlers;
}) {
  const { isLoading, sendMessage, stop } = mentorChat;
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
            <button
              onClick={stop}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted"
            >
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
        <div className="w-[520px] p-4">
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
