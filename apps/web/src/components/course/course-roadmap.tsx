"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { parseStoredGenerationError, isProgressiveCourseGenEnabled } from "@repo/shared";
import { toast } from "sonner";
import { useCourseEvents } from "@/hooks/use-course-events";

// If generation stays in 'generating' for longer than this, stop polling and
// show a "taking longer than usual" hint. The server-side cron sweeper (follow-
// up work) uses the same window to flip stuck jobs to 'failed'.
const GENERATION_POLL_MAX_MS = 15 * 60_000;

// Delay before auto-routing the learner into module 1's lesson 1 once that
// module becomes ready. Short enough that it feels immediate, long enough that
// the learner can hit "Stay on roadmap" if they want to preview the rest.
const AUTO_REDIRECT_MS = 800;



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
  const [pollStartedAt] = useState(() => Date.now());
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [autoRedirected, setAutoRedirected] = useState(false);
  const { data, isLoading, error } = trpc.goals.getCourseRoadmap.useQuery(
    { goalId },
    {
      // REST is the source of truth. While the course is still generating,
      // fall back to a slower poll (10s) so a user who lost the SSE
      // connection still converges on the correct state. The SSE event
      // stream (below) provides the fast path — its events `invalidate`
      // this query as they arrive, which is what keeps the UI snappy.
      refetchInterval: (query) => {
        if (query.state.data?.goal.generationStatus !== "generating") return false;
        if (Date.now() - pollStartedAt > GENERATION_POLL_MAX_MS) return false;
        return 10_000;
      },
      refetchIntervalInBackground: false,
    },
  );

  const goalStatus = data?.goal.generationStatus;
  // Progressive UI behaviors (SSE subscription, skeleton pills, auto-redirect)
  // are gated on a single flag so the rollout can be toggled instantly
  // without a redeploy. When the flag is OFF the roadmap degrades to the
  // pre-progressive UX: slow tRPC polling, no auto-redirect, no pills.
  const progressiveUiEnabled = isProgressiveCourseGenEnabled();
  const sseEnabled = progressiveUiEnabled && goalStatus === "generating";
  const events = useCourseEvents(goalId, sseEnabled);

  // Whenever an SSE event lands, invalidate the tRPC cache so the roadmap
  // picks up the new per-module state from the source of truth. This keeps
  // the rendered tree a pure function of the DB — the SSE events are just
  // a "wake up" signal.
  useEffect(() => {
    if (!sseEnabled) return;
    void utils.goals.getCourseRoadmap.invalidate({ goalId });
  }, [events.modulesById, events.goalStatus, sseEnabled, utils, goalId]);

  // Auto-redirect into lesson 1 the instant module 1's generation flips to
  // `ready`. Spec behavior: as soon as the first lesson is playable the
  // learner goes straight there — roadmap is still reachable via the back
  // button + the toast offers a "Stay here" option.
  const firstModule = data?.modules[0];
  const firstModuleReady = firstModule?.generationStatus === "ready";
  useEffect(() => {
    if (!progressiveUiEnabled) return;
    if (autoRedirected) return;
    if (!firstModuleReady) return;
    // Only auto-redirect on an in-flight course. If the user navigated
    // back to the roadmap for an already-completed or already-ready
    // course, don't hijack their navigation.
    if (goalStatus !== "generating" && goalStatus !== "ready") return;
    const completedAny = data?.modules.some((m) =>
      m.lessons.some((l) => l.status === "completed"),
    );
    if (completedAny) return;

    const t = setTimeout(() => {
      setAutoRedirected(true);
      router.push(`/course/${goalId}/learn`);
    }, AUTO_REDIRECT_MS);
    return () => clearTimeout(t);
  }, [progressiveUiEnabled, autoRedirected, firstModuleReady, goalStatus, data?.modules, goalId, router]);

  // Mirror the REST poll hard-cap into React state so the UI can switch
  // messaging once we stop polling without the goal having moved.
  useEffect(() => {
    if (data?.goal.generationStatus !== "generating") return;
    const remaining = Math.max(
      0,
      GENERATION_POLL_MAX_MS - (Date.now() - pollStartedAt),
    );
    const timer = setTimeout(() => setPollingTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, [data?.goal.generationStatus, pollStartedAt]);
  const skipMutation = trpc.goals.skipModule.useMutation({
    onSuccess: () => {
      void utils.goals.getCourseRoadmap.invalidate({ goalId });
      toast.success("Module skipped");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to skip module");
    },
  });

  const retryMutation = trpc.goals.retryModuleGeneration.useMutation({
    onSuccess: () => {
      void utils.goals.getCourseRoadmap.invalidate({ goalId });
      toast.success("Retrying module…");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to retry module");
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
  const isGenerating = goal.generationStatus === "generating";
  const generationFailed = goal.generationStatus === "failed";
  const failureCopy = generationFailed
    ? parseStoredGenerationError(goal.generationError)
    : null;

  function handleStartLesson() {
    router.push(`/course/${goalId}/learn`);
  }

  // Warm the tRPC cache for the two queries `/learn` fires in sequence
  // (`getNextLesson` → `getLessonBlocks`). Triggered on hover/focus of the
  // Start button so by the time `router.push` lands the client already has
  // the block payload — including `generatedContent` — which shaves an
  // extra round-trip off first-paint. Idempotent thanks to tRPC/TanStack
  // Query's 30s default staleTime.
  async function prefetchLesson() {
    try {
      await utils.goals.getNextLesson.prefetch({ goalId });
      const next = utils.goals.getNextLesson.getData({ goalId });
      if (next && next.type === "lesson") {
        void utils.goals.getLessonBlocks.prefetch({ lessonId: next.lesson.id });
      }
    } catch {
      /* best-effort; the real query will retry on the /learn page */
    }
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

      {/* Progressive-generation status banners */}
      {isGenerating && !pollingTimedOut && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              Building the rest of your course…
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your first lesson is ready — jump in now while we finish the other
              modules in the background.
            </p>
          </div>
        </div>
      )}
      {isGenerating && pollingTimedOut && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              This is taking longer than usual
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We&apos;ve stopped checking for updates automatically. Refresh
              the page to try again, or come back later.
            </p>
          </div>
        </div>
      )}
      {generationFailed && failureCopy && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              We couldn&apos;t finish generating this course
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {failureCopy.message} You can still work with the modules that
              were created.
            </p>
            {failureCopy.supportCode && (
              <p className="mt-1 text-[10px] font-mono text-muted-foreground/60">
                Support code: {failureCopy.supportCode}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod, mi) => {
          const status = (mod.status ?? "locked") as string;
          const styles = MODULE_STATUS_STYLES[status] ?? MODULE_STATUS_STYLES.locked;
          const isLocked = status === "locked";
          const isCompleted = status === "completed" || status === "skipped";
          const isActive = status === "in_progress" || status === "available";
          // Per-module generation lifecycle (columns added in migration
          // 0003). A module with `status=available` but
          // `generationStatus != 'ready'` is *not yet playable* — its
          // lesson block outlines haven't been persisted. The card
          // renders as a skeleton until it catches up.
          const generationStatus = mod.generationStatus as
            | "pending"
            | "generating"
            | "ready"
            | "failed"
            | undefined;
          // Per-module lifecycle UI (skeleton pill, retry affordance) is
          // only surfaced when the progressive flag is ON. When OFF the
          // roadmap falls back to the legacy all-or-nothing UX — generation
          // state is communicated by the goal-level banner alone.
          const isGeneratingModule =
            progressiveUiEnabled &&
            (generationStatus === "pending" || generationStatus === "generating");
          const isFailedModule =
            progressiveUiEnabled && generationStatus === "failed";
          const isPlayable = !isGeneratingModule && !isFailedModule;

          return (
            <div
              key={mod.id}
              className={cn(
                "rounded-xl border transition-all",
                styles.border,
                styles.bg,
                (isLocked || isGeneratingModule) && "opacity-60",
                isGeneratingModule && "animate-pulse",
              )}
              aria-busy={isGeneratingModule || undefined}
            >
              {/* Module header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", styles.border)}>
                  {isGeneratingModule ? (
                    <Loader2 className={cn("size-4 animate-spin", styles.icon)} />
                  ) : isFailedModule ? (
                    <AlertTriangle className="size-4 text-destructive" />
                  ) : isCompleted ? (
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
                    {isGeneratingModule && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-primary">
                        Generating
                      </span>
                    )}
                    {isFailedModule && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-destructive">
                        Failed
                      </span>
                    )}
                  </div>
                  {mod.description ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/50 line-clamp-1">
                      {mod.description}
                    </p>
                  ) : isGeneratingModule ? (
                    // Placeholder bar while we don't yet have description
                    // text. Maintains visual rhythm during skeleton state.
                    <div className="mt-1 h-1.5 w-32 rounded bg-muted-foreground/15" />
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {mod.estimatedMinutes && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                      <Clock className="size-3" />
                      {mod.estimatedMinutes}m
                    </span>
                  )}

                  {isFailedModule && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => retryMutation.mutate({ moduleId: mod.id })}
                      disabled={retryMutation.isPending}
                    >
                      <RotateCw className={cn("size-3", retryMutation.isPending && "animate-spin")} />
                      Retry
                    </Button>
                  )}

                  {isActive && isPlayable && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => handleStartLesson()}
                      onMouseEnter={() => void prefetchLesson()}
                      onFocus={() => void prefetchLesson()}
                    >
                      <Play className="size-3" />
                      {status === "in_progress" ? "Continue" : "Start"}
                    </Button>
                  )}

                  {mod.skipEligible && !isCompleted && isPlayable && (
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
