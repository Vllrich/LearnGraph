"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileAudio,
  FileText,
  FileType2,
  Globe,
  Image as ImageIcon,
  Loader2,
  PanelRight,
  PanelRightClose,
  Presentation,
  Search,
  Square,
  Volume2,
  CirclePlay,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { useMentorChat } from "@/hooks/use-mentor-chat";
import { ContentViewer } from "@/components/library/detail/content-viewer";
import { DocSearchBar } from "@/components/library/detail/doc-search-bar";
import { LoadingSkeleton } from "@/components/library/detail/loading-skeleton";
import { PersistentChatInput } from "@/components/library/detail/persistent-chat-input";
import { TabContent } from "@/components/library/detail/tab-content";
import { PANEL_TABS, type PanelTab, type SelectionActionType } from "@/components/library/detail/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; conv?: string }>;
};

export default function ContentDetailPage({ params, searchParams }: Props) {
  const { id } = use(params);
  const sp = use(searchParams);
  const initialTab = PANEL_TABS.find((t) => t.id.toLowerCase() === sp.tab?.toLowerCase())?.id;
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab ?? "Chat");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mentorChat = useMentorChat(id);
  const convAutoLoaded = useRef(false);

  useEffect(() => {
    if (convAutoLoaded.current || !sp.conv) return;
    convAutoLoaded.current = true;
    setPanelOpen(true);
    setActiveTab("Chat");
    (async () => {
      try {
        const res = await fetch(
          `/api/trpc/mentor.getConversation?input=${encodeURIComponent(JSON.stringify({ id: sp.conv }))}`
        );
        const json = await res.json();
        const conv = json?.result?.data;
        if (conv?.messages) {
          mentorChat.loadConversation(
            conv.messages.map((m: { role: string; content: string; citations?: unknown[] }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              citations: m.citations,
            })),
            sp.conv!
          );
        }
      } catch { /* ignore */ }
    })();
  }, [sp.conv]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const sourceIcon =
    data.sourceType === "youtube" ? (
      <CirclePlay className="size-3.5 shrink-0 text-red-500/80" />
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
    );

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const fullText = data.chunks.map((c) => c.content).join("\n\n");
    if (!fullText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/30 px-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {sourceIcon}
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

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document viewer */}
        <div className="flex flex-1 flex-col overflow-hidden">
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
              onClick={toggleSpeech}
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

          {searchOpen && <DocSearchBar data={data} />}

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

        {panelOpen && data.status === "ready" && <div className="w-px bg-border/30" />}

        {/* Right: AI Panel */}
        {panelOpen && data.status === "ready" && (
          <div className="flex w-[520px] shrink-0 flex-col">
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

            <div className="flex flex-1 flex-col overflow-hidden">
              <div ref={panelScrollRef} className="flex-1 overflow-y-auto">
                <TabContent
                  tab={activeTab}
                  data={data}
                  learningObjectId={id}
                  mentorChat={mentorChat}
                />
              </div>

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
