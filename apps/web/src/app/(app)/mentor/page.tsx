"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import Link from "next/link";
import {
  MessageCircle,
  Loader2,
  ArrowRight,
  BookOpen,
  Plus,
  Sparkles,
  Brain,
  Target,
  Zap,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Flame,
  Clock,
  HelpCircle,
  Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function MentorPage() {
  const { data: conversations, isLoading: convsLoading } =
    trpc.mentor.listConversations.useQuery();
  const { data: library } = trpc.library.list.useQuery({ limit: 50, offset: 0 });
  const { data: stats } = trpc.review.getStats.useQuery();
  const { data: queue } = trpc.review.getDailyQueue.useQuery({ limit: 5 });
  const { data: gamification } = trpc.gamification.getStreakAndXp.useQuery();

  const readyItems = (library?.items ?? []).filter((i) => i.status === "ready");
  const [showPicker, setShowPicker] = useState(false);
  const [convsExpanded, setConvsExpanded] = useState(false);

  const mastery = stats?.mastery;
  const totalConcepts = mastery?.total ?? 0;
  const weakCount = (mastery?.m0 ?? 0) + (mastery?.m1 ?? 0);
  const strongCount = (mastery?.m4 ?? 0) + (mastery?.m5 ?? 0);

  const quickActions = [
    {
      icon: Target,
      label: "Quiz me on weak areas",
      href: "/mentor/chat",
      prompt: "Quiz me on the concepts I'm weakest at. Start with one question and adapt based on my answers.",
    },
    {
      icon: HelpCircle,
      label: "Explain a concept",
      href: "/mentor/chat",
      prompt: "What concept should I review next? Pick something I'm struggling with and explain it clearly.",
    },
    {
      icon: Route,
      label: "Create a study plan",
      href: "/mentor/chat",
      prompt: "Create a focused study plan for today based on what concepts are due for review and where my mastery is lowest.",
    },
    {
      icon: Zap,
      label: "Continue where I left off",
      href: conversations?.[0]?.learningObjectId
        ? `/library/${conversations[0].learningObjectId}?tab=chat&conv=${conversations[0].id}`
        : "/mentor/chat",
    },
  ];

  return (
    <div className="px-6 pb-6 pt-16 lg:px-10 lg:pt-20">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI Mentor</h1>
          <p className="text-[13px] text-muted-foreground">
            Your personal study coach — powered by your learning materials
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

      {/* Progress Snapshot */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Flame}
          label="Streak"
          value={`${gamification?.currentStreak ?? stats?.streak ?? 0} days`}
          sub={gamification?.longestStreak ? `Best: ${gamification.longestStreak}` : undefined}
        />
        <StatCard
          icon={Brain}
          label="Mastered"
          value={`${strongCount}/${totalConcepts}`}
          sub={totalConcepts > 0 ? `${Math.round((strongCount / totalConcepts) * 100)}% of concepts` : "No concepts yet"}
        />
        <StatCard
          icon={Clock}
          label="Due for review"
          value={`${queue?.totalDue ?? 0}`}
          sub={queue?.totalNew ? `${queue.totalNew} new` : "All caught up"}
        />
      </div>

      {/* Today's Focus */}
      {(queue?.items?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <Target className="size-4 text-primary" />
            Today&apos;s Focus
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {queue!.items.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/50 p-3"
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    (item.masteryLevel ?? 0) <= 1
                      ? "bg-red-500/10 text-red-500"
                      : (item.masteryLevel ?? 0) <= 3
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-emerald-500/10 text-emerald-500"
                  )}
                >
                  <Brain className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-medium">{item.conceptName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.fsrsRetrievability != null
                      ? `${Math.round(item.fsrsRetrievability * 100)}% recall`
                      : "New"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {(queue?.totalDue ?? 0) > 6 && (
            <Link
              href="/practice"
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
            >
              View all {queue!.totalDue} due
              <ArrowRight className="size-3" />
            </Link>
          )}
        </section>
      )}

      {/* Weak Areas */}
      {weakCount > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <TrendingUp className="size-4 text-amber-500" />
            Needs Attention
            <span className="text-[11px] font-normal text-muted-foreground">
              {weakCount} concept{weakCount !== 1 ? "s" : ""} at low mastery
            </span>
          </h2>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[12px] text-muted-foreground">
              You have {weakCount} concept{weakCount !== 1 ? "s" : ""} at mastery level 0-1. 
              Ask the mentor to explain them or start a focused review session.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5 text-[12px]"
              asChild
            >
              <Link href="/mentor/chat">
                <Target className="size-3" />
                Quiz me on weak areas
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="mb-6">
        <h2 className="mb-3 text-[13px] font-semibold">Quick Actions</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {quickActions.map(({ icon: Icon, label, href, prompt }) => (
            <Link
              key={label}
              href={prompt ? `${href}?prompt=${encodeURIComponent(prompt)}` : href}
              className="flex items-center gap-3 rounded-lg border border-border/30 p-3 transition-all hover:border-primary/30 hover:bg-muted/20"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8">
                <Icon className="size-4 text-primary" />
              </div>
              <span className="text-[13px] font-medium">{label}</span>
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground/30" />
            </Link>
          ))}
        </div>
      </section>

      {/* Material picker */}
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

      {/* Recent Conversations (collapsible) */}
      <section>
        <button
          onClick={() => setConvsExpanded((v) => !v)}
          className="mb-3 flex w-full items-center gap-2 text-left"
        >
          <h2 className="text-[13px] font-semibold">Recent Conversations</h2>
          <span className="text-[11px] text-muted-foreground">
            {(conversations ?? []).length}
          </span>
          {convsExpanded ? (
            <ChevronUp className="ml-auto size-4 text-muted-foreground/40" />
          ) : (
            <ChevronDown className="ml-auto size-4 text-muted-foreground/40" />
          )}
        </button>

        {convsExpanded && (
          <>
            {convsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (conversations ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border/30 py-12 text-center">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <MessageCircle className="size-6 text-muted-foreground/40" />
                </div>
                <p className="text-[13px] text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 rounded-xl border border-border/30">
                {(conversations ?? []).map((conv) => (
                  <ConversationRow key={conv.id} conversation={conv} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
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
    : `/mentor/chat?conv=${conversation.id}`;

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
