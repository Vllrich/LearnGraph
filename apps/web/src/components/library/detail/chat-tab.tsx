"use client";

import { useEffect, useRef, useState } from "react";
import { Feather, Lightbulb, Route, Sparkles } from "lucide-react";
import { trpc } from "@/trpc/client";
import { ChatBubble } from "./chat-bubble";
import type { MentorChatHandlers } from "./types";

export function ChatTab({
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
