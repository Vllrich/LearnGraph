"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import Link from "next/link";
import { MessageCircle, Loader2, ArrowRight, BookOpen, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function MentorPage() {
  const { data: conversations, isLoading: convsLoading } = trpc.mentor.listConversations.useQuery();
  const { data: library } = trpc.library.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const readyItems = (library?.items ?? []).filter((i) => i.status === "ready");
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="px-6 pb-6 pt-16 lg:px-10 lg:pt-20">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI Mentor</h1>
          <p className="text-[13px] text-muted-foreground">
            Ask questions grounded in your learning materials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href="/mentor/chat">
              <Sparkles className="size-3.5" />
              All Courses
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowPicker(true)}>
            <Plus className="size-3.5" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Material picker for new chat */}
      {showPicker && (
        <div className="mb-6 rounded-xl border border-border/40 bg-card p-4">
          <h2 className="mb-3 text-[13px] font-medium">Choose material to discuss</h2>
          {readyItems.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No materials available.{" "}
              <Link href="/library" className="text-primary underline">
                Upload something first
              </Link>
              .
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {readyItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/library/${item.id}?tab=chat`}
                  className="flex items-center gap-3 rounded-lg border border-border/30 p-3 transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
                    <BookOpen className="size-4 text-muted-foreground/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-medium">{item.title}</p>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40" />
                </Link>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowPicker(false)}
            className="mt-3 text-[12px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Conversation history */}
      {convsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (conversations ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-3 rounded-full bg-muted p-4">
            <MessageCircle className="size-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-sm font-medium">No conversations yet</h2>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
            Start a chat from any learning material to get AI-powered tutoring.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowPicker(true)}>
            <Plus className="size-3.5" />
            Start your first chat
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-xl border border-border/30">
          {(conversations ?? []).map((conv) => (
            <ConversationRow key={conv.id} conversation={conv} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
}: {
  conversation: {
    id: string;
    title: string | null;
    learningObjectId: string | null;
    updatedAt: Date | string | null;
  };
}) {
  const href = conversation.learningObjectId
    ? `/library/${conversation.learningObjectId}?tab=chat&conv=${conversation.id}`
    : `/library`;

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/30")}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
        <MessageCircle className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="truncate text-[13px] font-medium">
          {conversation.title ?? "Untitled conversation"}
        </h3>
        {conversation.updatedAt && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {new Date(conversation.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/30" />
    </Link>
  );
}
