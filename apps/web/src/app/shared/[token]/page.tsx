"use client";

import { use } from "react";
import { trpc } from "@/trpc/client";
import { Loader2, BookOpen, Clock, Eye } from "lucide-react";
import Link from "next/link";

export default function SharedCurriculumPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data, isLoading, error } = trpc.goals.getSharedCurriculum.useQuery({ token });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center px-6">
        <h1 className="text-lg font-medium">Curriculum not found</h1>
        <p className="mt-1 text-[13px] text-muted-foreground/60">
          This link may have expired or been removed.
        </p>
        <Link href="/" className="mt-4 text-[13px] text-primary hover:underline">
          Go to LearnGraph
        </Link>
      </div>
    );
  }

  const totalMinutes = data.items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground/50">
          <BookOpen className="size-3" />
          Shared curriculum from LearnGraph
        </div>

        <h1 className="text-2xl font-semibold font-(family-name:--font-source-serif)">
          {data.title}
        </h1>
        {data.description && (
          <p className="mt-2 text-[14px] text-muted-foreground/70">{data.description}</p>
        )}

        <div className="mt-3 flex items-center gap-4 text-[12px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <BookOpen className="size-3" />
            {data.items.length} chapters
          </span>
          {totalMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />~{totalMinutes}min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="size-3" />
            {data.viewCount} views
          </span>
        </div>

        <div className="mt-8 space-y-3">
          {data.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-xl border border-border/30 p-4"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[12px] font-medium text-muted-foreground">
                {idx + 1}
              </span>
              <div>
                <p className="text-[14px] font-medium">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground/60">{item.description}</p>
                )}
                <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground/40">
                  {item.estimatedMinutes && <span>~{item.estimatedMinutes}min</span>}
                  {item.learningMethod && <span>{item.learningMethod.replace("_", " ")}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-[14px] font-medium text-background"
          >
            Start learning on LearnGraph
          </Link>
        </div>
      </div>
    </div>
  );
}
