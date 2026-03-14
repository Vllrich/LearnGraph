"use client";

import { useRouter } from "next/navigation";
import {
  Lock,
  CheckCircle2,
  Play,
  SkipForward,
  Clock,
  Loader2,
  AlertTriangle,
  Sparkles,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";



type CourseRoadmapProps = {
  goalId: string;
};

const MODULE_STATUS_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  completed: { bg: "bg-green-500/5", border: "border-green-500/20", icon: "text-green-500" },
  in_progress: { bg: "bg-primary/5", border: "border-primary/30", icon: "text-primary" },
  available: { bg: "bg-card", border: "border-border/30", icon: "text-foreground" },
  locked: { bg: "bg-muted/20", border: "border-border/15", icon: "text-muted-foreground/30" },
  skipped: { bg: "bg-muted/10", border: "border-border/15", icon: "text-muted-foreground/40" },
};

export function CourseRoadmap({ goalId }: CourseRoadmapProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.goals.getCourseRoadmap.useQuery({ goalId });
  const skipMutation = trpc.goals.skipModule.useMutation({
    onSuccess: () => {
      void utils.goals.getCourseRoadmap.invalidate({ goalId });
      toast.success("Module skipped");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to skip module");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-muted-foreground">Failed to load course roadmap.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  const { goal, modules } = data;
  const totalLessons = modules.reduce((s, m) => s + m.totalLessons, 0);
  const completedLessons = modules.reduce((s, m) => s + m.completedLessons, 0);
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  function handleStartLesson() {
    router.push(`/course/${goalId}/learn`);
  }

  function handleSkipModule(moduleId: string) {
    skipMutation.mutate({ moduleId });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{modules.length} modules</span>
          <span>{totalLessons} lessons</span>
          <span>{overallProgress}% complete</span>
        </div>
        <Progress value={overallProgress} className="mt-3 h-2" />
      </div>

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod, mi) => {
          const status = (mod.status ?? "locked") as string;
          const styles = MODULE_STATUS_STYLES[status] ?? MODULE_STATUS_STYLES.locked;
          const isLocked = status === "locked";
          const isCompleted = status === "completed" || status === "skipped";
          const isActive = status === "in_progress" || status === "available";

          return (
            <div
              key={mod.id}
              className={cn(
                "rounded-xl border transition-all",
                styles.border,
                styles.bg,
                isLocked && "opacity-60",
              )}
            >
              {/* Module header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", styles.border)}>
                  {isCompleted ? (
                    <CheckCircle2 className={cn("size-4", styles.icon)} />
                  ) : isLocked ? (
                    <Lock className={cn("size-4", styles.icon)} />
                  ) : (
                    <span className={cn("text-sm font-semibold", styles.icon)}>{mi + 1}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-medium", isLocked && "text-muted-foreground/50")}>
                      {mod.title}
                    </p>
                    {mod.moduleType !== "mandatory" && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                        {mod.moduleType}
                      </span>
                    )}
                  </div>
                  {mod.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/50 line-clamp-1">
                      {mod.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {mod.estimatedMinutes && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                      <Clock className="size-3" />
                      {mod.estimatedMinutes}m
                    </span>
                  )}

                  {isActive && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => handleStartLesson()}
                    >
                      <Play className="size-3" />
                      {status === "in_progress" ? "Continue" : "Start"}
                    </Button>
                  )}

                  {mod.skipEligible && !isCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => handleSkipModule(mod.id)}
                      disabled={skipMutation.isPending}
                    >
                      <SkipForward className="size-3" />
                      Test out
                    </Button>
                  )}
                </div>
              </div>

              {/* Unlock requirements for locked modules */}
              {isLocked && mod.unlockRequirements?.length > 0 && (
                <div className="border-t border-border/15 px-4 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3" />
                    Master these concepts to unlock:
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {mod.unlockRequirements.map((req: { conceptName: string; retrievability: number }, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 text-[11px] text-muted-foreground">{req.conceptName}</span>
                        <span className="text-[10px] text-muted-foreground/60">{req.retrievability}%</span>
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-amber-500/60 transition-all"
                            style={{ width: `${req.retrievability}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lessons inside module */}
              {isActive && mod.lessons.length > 0 && (
                <div className="border-t border-border/15 px-4 py-2">
                  <div className="space-y-1">
                    {mod.lessons.map((lesson) => {
                      const lessonDone = lesson.status === "completed" || lesson.status === "skipped";
                      const lessonActive = lesson.status === "in_progress" || lesson.status === "pending";
                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-2 py-1"
                        >
                          {lessonDone ? (
                            <CheckCircle2 className="size-3 text-green-500" />
                          ) : (
                            <div className={cn(
                              "size-3 rounded-full border",
                              lessonActive ? "border-primary bg-primary/20" : "border-border/30",
                            )} />
                          )}
                          <span className={cn(
                            "flex-1 text-[12px]",
                            lessonDone && "text-muted-foreground/50 line-through",
                            lessonActive && "font-medium",
                          )}>
                            {lesson.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground/30">
                            {lesson.completedBlocks}/{lesson.blockCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Skill bar and progress for non-locked modules */}
              {!isLocked && (mod.progressPercent > 0 || mod.conceptSkill > 0) && (
                <div className="space-y-1.5 px-4 pb-2">
                  {mod.progressPercent > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/50 w-12">Lessons</span>
                      <Progress value={mod.progressPercent} className="h-1 flex-1" />
                    </div>
                  )}
                  {mod.conceptSkill > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/50 w-12 flex items-center gap-0.5">
                        <Brain className="size-2.5" /> Skill
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-violet-500/70 transition-all"
                          style={{ width: `${mod.conceptSkill}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground/40">{mod.conceptSkill}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mode adaptation suggestion */}
      {overallProgress > 20 && (
        <ModeSuggestionCard goalId={goalId} modules={modules} />
      )}
    </div>
  );
}

function ModeSuggestionCard({
  modules,
}: {
  goalId: string;
  modules: Array<{
    lessons: Array<{
      blockCount: number;
      completedBlocks: number;
      blockTypes: string[];
    }>;
  }>;
}) {
  const allBlockTypes = modules.flatMap((m) => m.lessons.flatMap((l) => l.blockTypes));
  const completedLessons = modules.flatMap((m) =>
    m.lessons.filter((l) => (l as { status?: string }).status === "completed"),
  );
  if (completedLessons.length < 3) return null;

  const checkpointCount = allBlockTypes.filter((t) => t === "checkpoint").length;
  const reflectionCount = allBlockTypes.filter((t) => t === "reflection").length;
  const totalBlocks = allBlockTypes.length;
  if (totalBlocks === 0) return null;

  const checkpointRatio = checkpointCount / totalBlocks;
  const reflectionRatio = reflectionCount / totalBlocks;

  let suggestion: string | null = null;
  if (checkpointRatio > 0.3 && reflectionRatio < 0.05) {
    suggestion = "You&apos;re acing checkpoints! Try switching to Deep Mastery for more challenge.";
  } else if (reflectionRatio > 0.2) {
    suggestion = "Great reflection scores! Apply Faster mode could help you build practical skills.";
  }

  if (!suggestion) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-500" />
      <div>
        <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
          Mode suggestion
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: suggestion }} />
      </div>
    </div>
  );
}
