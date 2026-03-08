"use client";

import { useState } from "react";
import {
  Plus,
  FileText,
  Youtube,
  Search,
  Loader2,
  Zap,
  Flame,
  Brain,
  Activity,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { UploadDialog } from "@/components/library/upload-dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];

export default function HomePage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.library.list.useQuery(
    { limit: 100, offset: 0 },
    { refetchInterval: 10_000 }
  );
  const { data: stats } = trpc.review.getStats.useQuery();
  const { data: queue } = trpc.review.getDailyQueue.useQuery();

  const items = (data?.items ?? []).filter(
    (i) => !search || i.title.toLowerCase().includes(search.toLowerCase())
  );
  const hasContent = (data?.items ?? []).length > 0;

  const streak = stats?.streak ?? 0;
  const mastery = stats?.mastery;
  const totalConcepts = mastery
    ? Number(mastery.m0) +
      Number(mastery.m1) +
      Number(mastery.m2) +
      Number(mastery.m3) +
      Number(mastery.m4) +
      Number(mastery.m5)
    : 0;
  const healthyConcepts = mastery ? Number(mastery.m4) + Number(mastery.m5) : 0;
  const knowledgeHealth =
    totalConcepts > 0 ? Math.round((healthyConcepts / totalConcepts) * 100) : 0;
  const dueCount = (queue?.totalDue ?? 0) + (queue?.totalNew ?? 0);

  return (
    <div className="min-h-screen">
      {/* Empty state */}
      {!hasContent && !isLoading && (
        <div className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <h1 className="text-xl font-medium tracking-tight text-foreground/80">
            What do you want to learn?
          </h1>
          <p className="mt-2 max-w-sm text-[14px] text-muted-foreground/60">
            Upload a PDF or YouTube video to get started with summaries, quizzes, and AI tutoring.
          </p>
          <button
            onClick={() => setUploadOpen(true)}
            className="mt-6 flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" />
            Add learning material
          </button>
        </div>
      )}

      {/* Dashboard with real data */}
      {(hasContent || isLoading) && (
        <div className="px-6 py-6 lg:px-10">
          {/* Dashboard cards */}
          {totalConcepts > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link
                href="/review"
                className="group rounded-xl border border-border/30 px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-green-500" />
                  <span className="text-[11px] text-muted-foreground/50">Due Today</span>
                </div>
                <p className="mt-1 text-xl font-bold">{dueCount}</p>
                {dueCount > 0 && (
                  <p className="mt-0.5 text-[11px] text-primary group-hover:underline">
                    Start Review
                  </p>
                )}
              </Link>

              <div className="rounded-xl border border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Flame
                    className={cn(
                      "size-4",
                      streak > 0 ? "text-amber-500" : "text-muted-foreground/30"
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground/50">Streak</span>
                </div>
                <p className="mt-1 text-xl font-bold">{streak}d</p>
              </div>

              <div className="rounded-xl border border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-primary" />
                  <span className="text-[11px] text-muted-foreground/50">Concepts</span>
                </div>
                <p className="mt-1 text-xl font-bold">{totalConcepts}</p>
              </div>

              <div className="rounded-xl border border-border/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-blue-500" />
                  <span className="text-[11px] text-muted-foreground/50">Health</span>
                </div>
                <p className="mt-1 text-xl font-bold">{knowledgeHealth}%</p>
                <div className="mt-1 flex gap-0.5">
                  {mastery &&
                    [mastery.m0, mastery.m1, mastery.m2, mastery.m3, mastery.m4, mastery.m5].map(
                      (v, i) => (
                        <div
                          key={i}
                          className="h-1 rounded-full"
                          style={{
                            backgroundColor: MASTERY_COLORS[i],
                            width: `${totalConcepts > 0 ? (Number(v) / totalConcepts) * 100 : 0}%`,
                            minWidth: Number(v) > 0 ? "3px" : "0",
                          }}
                        />
                      )
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Top bar */}
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
              <input
                type="text"
                placeholder="Search your materials..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full max-w-sm rounded-lg border-0 bg-muted/30 pl-9 pr-4 text-[13px] placeholder:text-muted-foreground/40 focus:bg-muted/50 focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          ) : search ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No results for &ldquo;{search}&rdquo;</p>
            </div>
          ) : null}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

type ContentItem = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  summaryTldr: string | null;
  createdAt: Date | string | null;
};

function ContentCard({ item }: { item: ContentItem }) {
  const isReady = item.status === "ready";
  const isProcessing = item.status === "processing";

  const card = (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/30 bg-card transition-all hover:border-border/50 hover:shadow-sm",
        isReady && "cursor-pointer"
      )}
    >
      {/* Thumbnail */}
      <div className="flex h-28 items-center justify-center bg-muted/30">
        {item.sourceType === "youtube" ? (
          <Youtube className="size-8 text-muted-foreground/20" />
        ) : (
          <FileText className="size-8 text-muted-foreground/20" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[14px] font-medium leading-snug">{item.title}</h3>

        {item.summaryTldr && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {item.summaryTldr}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-3">
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Processing...
            </span>
          )}
          {item.status === "failed" && <span className="text-[11px] text-destructive">Failed</span>}
          {isReady && item.createdAt && (
            <span className="text-[11px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (isReady) {
    return (
      <Link href={`/library/${item.id}`} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
