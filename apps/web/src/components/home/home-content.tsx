"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  Link2,
  Loader2,
  Zap,
  Flame,
  ArrowUp,
  ArrowRight,
  Sparkles,
  Trash2,
  Target,
  Calendar,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { UploadDialog } from "@/components/library/upload-dialog";
import { CourseSetupWizard } from "@/components/course/course-setup-wizard";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DiscoveryFeed } from "@/components/home/discovery-feed";
import type { GoalType } from "@repo/shared";

const GOAL_BADGE: Record<
  GoalType,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  exam_prep: { label: "Exam Prep", variant: "default" },
  skill_building: { label: "Career", variant: "secondary" },
  course_supplement: { label: "Course", variant: "outline" },
  exploration: { label: "Exploration", variant: "outline" },
};

function topicGradient(title: string) {
  const gradients = [
    "from-violet-600 to-indigo-500",
    "from-blue-600 to-cyan-500",
    "from-emerald-600 to-teal-500",
    "from-orange-500 to-amber-400",
    "from-rose-600 to-pink-500",
    "from-purple-600 to-violet-500",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  return gradients[Math.abs(hash) % gradients.length];
}

export function HomeContent() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<"file" | "url">("file");
  const [chatInput, setChatInput] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTopic, setWizardTopic] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: activeGoals } = trpc.goals.getActive.useQuery();
  const { data: stats } = trpc.review.getStats.useQuery();
  const { data: queue } = trpc.review.getDailyQueue.useQuery({ mode: "standard" });

  const deleteGoal = trpc.goals.delete.useMutation({
    onSuccess: () => {
      void utils.goals.getActive.invalidate();
      setConfirmDeleteId(null);
    },
  });

  const hasGoals = (activeGoals ?? []).length > 0;
  const streak = stats?.streak ?? 0;
  const dueCount = (queue?.totalDue ?? 0) + (queue?.totalNew ?? 0);

  const openWizard = useCallback((topic: string) => {
    if (!topic.trim()) return;
    setWizardTopic(topic.trim());
    setChatInput("");
    setWizardOpen(true);
  }, []);

  function openUpload(tab: "file" | "url") {
    setUploadTab(tab);
    setUploadOpen(true);
  }

  return (
    <div className="min-h-screen">
      <div className="flex flex-col items-center px-4 pb-6 pt-16 text-center lg:pt-20">
        <div className="flex w-full max-w-2xl items-center justify-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-(family-name:--font-source-serif)">
            What do you want to learn today?
          </h1>
          {streak > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
              <Flame className="size-3 text-amber-500" />
              {streak}d
            </span>
          )}
        </div>

        {/* Chat input */}
        <div className="mt-4 flex w-full max-w-2xl items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-2.5 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md">
          <Sparkles className="size-4 text-muted-foreground/40" />
          <input
            type="text"
            placeholder={hasGoals ? "Start a new course..." : "Learn anything..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && openWizard(chatInput)}
            className="flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            onClick={() => openWizard(chatInput)}
            disabled={!chatInput.trim()}
            className={cn(
              "flex size-7 items-center justify-center rounded-lg transition-all",
              chatInput.trim()
                ? "bg-foreground text-background hover:opacity-80"
                : "bg-muted/40 text-muted-foreground/30 cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>

        {/* Upload buttons */}
        <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
          <span>or bring your own material</span>
          <button
            onClick={() => openUpload("file")}
            className="flex items-center gap-1 rounded-md border border-border/40 px-2.5 py-1.5 transition-all hover:border-border/60 hover:bg-muted/30"
          >
            <Upload className="size-3" />
            Upload
          </button>
          <button
            onClick={() => openUpload("url")}
            className="flex items-center gap-1 rounded-md border border-border/40 px-2.5 py-1.5 transition-all hover:border-border/60 hover:bg-muted/30"
          >
            <Link2 className="size-3" />
            Paste link
          </button>
        </div>

        {/* Discovery feed — personalized, trending, gaps, surprise me */}
        <DiscoveryFeed onSelectTopic={openWizard} />

        {/* Active courses */}
        {hasGoals && (
          <div className="mt-6 w-full max-w-2xl pt-16 text-left">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Courses
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {activeGoals!.map((goal, idx) => {
                const pct =
                  goal.totalItems > 0
                    ? Math.round((goal.completedItems / goal.totalItems) * 100)
                    : 0;
                const badgeInfo = GOAL_BADGE[(goal.goalType as GoalType) ?? "exploration"];
                const totalMins = (goal.totalItems - goal.completedItems) * 8;
                const remainingLabel =
                  totalMins >= 60
                    ? `~${Math.round(totalMins / 60)}h left`
                    : totalMins > 0
                      ? `~${totalMins}m left`
                      : "Complete!";
                const isConfirming = confirmDeleteId === goal.id;
                return (
                  <div key={goal.id} className="group relative">
                    <Link
                      href={`/course/${goal.id}`}
                      className="block rounded-xl border border-border/30 bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                        {goal.coverImageUrl ? (
                          <img
                            src={goal.coverImageUrl}
                            alt={goal.title}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className={cn(
                              "absolute inset-0 bg-linear-to-br",
                              topicGradient(goal.title)
                            )}
                          />
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                        {badgeInfo && (
                          <div className="absolute top-2.5 left-2.5">
                            <Badge
                              variant={badgeInfo.variant}
                              className="text-[10px] px-1.5 py-0 bg-black/50 border-white/20 text-white backdrop-blur-sm"
                            >
                              {badgeInfo.label}
                            </Badge>
                          </div>
                        )}
                        {dueCount > 0 && idx === 0 && (
                          <div className="absolute top-2.5 right-2.5">
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                              <Zap className="size-2.5" />
                              {dueCount} due
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 drop-shadow">
                            {goal.title}
                          </p>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-muted-foreground">
                            {goal.completedItems} / {goal.totalItems} concepts
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {remainingLabel}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {goal.goalType === "exam_prep" && (
                          <ExamReadinessBadge goalId={goal.id} />
                        )}
                        {goal.nextItem && (
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {goal.nextItem.title}
                            </p>
                          </div>
                        )}
                      </div>
                    </Link>

                    {!isConfirming ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(goal.id);
                        }}
                        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition-all hover:bg-destructive hover:text-white group-hover:opacity-100"
                        title="Delete course"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/90 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-sm font-medium">Delete this course?</p>
                        <p className="text-[11px] text-muted-foreground px-6 text-center">
                          All progress will be lost permanently.
                        </p>
                        <div className="mt-1 flex gap-2">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-border/50 px-3 py-1.5 text-xs hover:bg-muted"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteGoal.mutate({ id: goal.id })}
                            disabled={deleteGoal.isPending}
                            className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                          >
                            {deleteGoal.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <CourseSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        topic={wizardTopic}
      />
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} defaultTab={uploadTab} />
    </div>
  );
}

function ExamReadinessBadge({ goalId }: { goalId: string }) {
  const { data } = trpc.review.getExamReadiness.useQuery({ goalId });
  if (!data) return null;

  const color =
    data.readinessScore >= 80
      ? "text-green-500"
      : data.readinessScore >= 50
        ? "text-amber-500"
        : "text-red-400";

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Target className={cn("size-3", color)} />
        <span className={cn("text-[11px] font-semibold", color)}>{data.readinessScore}% ready</span>
      </div>
      {data.daysUntilExam != null && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
          <Calendar className="size-2.5" />
          {data.daysUntilExam}d left
        </span>
      )}
    </div>
  );
}
