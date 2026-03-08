"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  Link2,
  Loader2,
  Zap,
  Flame,
  Brain,
  Activity,
  ArrowUp,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { UploadDialog } from "@/components/library/upload-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GoalType, LearnerLevel } from "@repo/shared";

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];

const POPULAR_TOPICS = [
  { title: "Python", subtitle: "Beginner friendly" },
  { title: "Machine Learning", subtitle: "Core concepts" },
  { title: "Calculus", subtitle: "Exam prep" },
  { title: "JavaScript", subtitle: "Web development" },
  { title: "Statistics", subtitle: "Data science" },
  { title: "AWS Cloud", subtitle: "Certification" },
];

const GOAL_OPTIONS: { id: GoalType; label: string; icon: string }[] = [
  { id: "exam_prep", label: "Exam", icon: "📝" },
  { id: "skill_building", label: "Career", icon: "💼" },
  { id: "course_supplement", label: "Course", icon: "📚" },
  { id: "exploration", label: "Curious", icon: "✨" },
];

const LEVEL_OPTIONS: { id: LearnerLevel; label: string; icon: string }[] = [
  { id: "beginner", label: "Brand new", icon: "🌱" },
  { id: "some_knowledge", label: "Some knowledge", icon: "📖" },
  { id: "experienced", label: "Experienced", icon: "🎓" },
];

type IntakeStep = "idle" | "goal" | "level" | "generating";

export default function HomePage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<"file" | "url">("file");
  const [chatInput, setChatInput] = useState("");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>("idle");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  const { data: activeGoals } = trpc.goals.getActive.useQuery();
  const { data: stats } = trpc.review.getStats.useQuery();
  const { data: queue } = trpc.review.getDailyQueue.useQuery();

  const hasGoals = (activeGoals ?? []).length > 0;
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

  const startIntake = useCallback((topic: string) => {
    if (!topic.trim()) return;
    setSelectedTopic(topic.trim());
    setIntakeStep("goal");
  }, []);

  const selectGoal = useCallback((goal: GoalType) => {
    setSelectedGoal(goal);
    setIntakeStep("level");
  }, []);

  const [error, setError] = useState<string | null>(null);

  const selectLevel = useCallback(
    async (level: LearnerLevel) => {
      if (!selectedTopic || !selectedGoal) return;
      setIntakeStep("generating");
      setGenerating(true);
      setError(null);

      try {
        const res = await fetch("/api/learn/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: selectedTopic,
            goalType: selectedGoal,
            currentLevel: level,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          router.push(`/learn/${data.goalId}`);
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("[learn/start] Failed:", res.status, errData);
          setError(errData.error ?? "Something went wrong. Please try again.");
          setIntakeStep("idle");
          setGenerating(false);
        }
      } catch (err) {
        console.error("[learn/start] Network error:", err);
        setError("Network error. Please check your connection.");
        setIntakeStep("idle");
        setGenerating(false);
      }
    },
    [selectedTopic, selectedGoal, router]
  );

  const startPopularTopic = useCallback((topic: string) => {
    setSelectedTopic(topic);
    setIntakeStep("goal");
  }, []);

  const resetIntake = useCallback(() => {
    setIntakeStep("idle");
    setSelectedTopic("");
    setSelectedGoal(null);
    setChatInput("");
    setGenerating(false);
  }, []);

  function openUpload(tab: "file" | "url") {
    setUploadTab(tab);
    setUploadOpen(true);
  }

  return (
    <div className="min-h-screen">
      {/* Returning user: Continue Learning hero */}
      {hasGoals && intakeStep === "idle" && (
        <div className="px-6 pt-8 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <div className="mb-2 flex items-center justify-between">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                {getGreeting()}
              </h1>
              {streak > 0 && (
                <span className="flex items-center gap-1 text-sm">
                  <Flame className="size-4 text-amber-500" />
                  <span className="font-semibold">{streak}d</span>
                </span>
              )}
            </div>

            {activeGoals!.slice(0, 1).map((goal) => (
              <div
                key={goal.id}
                className="rounded-xl border border-border/40 bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{goal.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {goal.nextItem ? `Next: ${goal.nextItem.title}` : "All concepts completed!"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {goal.completedItems} of {goal.totalItems} concepts
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dueCount > 0 && (
                      <Link href="/review">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Zap className="size-3.5" />
                          Review {dueCount}
                        </Button>
                      </Link>
                    )}
                    <Link href={`/learn/${goal.id}`}>
                      <Button size="sm" className="gap-1.5">
                        Continue
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${goal.totalItems > 0 ? (goal.completedItems / goal.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row (returning users) */}
      {totalConcepts > 0 && intakeStep === "idle" && (
        <div className="mt-6 px-6 lg:px-10">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Link
              href="/review"
              className="group rounded-xl border border-border/30 bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-green-500" />
                <span className="text-[11px] text-muted-foreground/50">Due Today</span>
              </div>
              <p className="mt-1 text-xl font-bold">{dueCount}</p>
            </Link>
            <div className="rounded-xl border border-border/30 bg-card px-4 py-3">
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
            <div className="rounded-xl border border-border/30 bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <Brain className="size-4 text-primary" />
                <span className="text-[11px] text-muted-foreground/50">Concepts</span>
              </div>
              <p className="mt-1 text-xl font-bold">{totalConcepts}</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card px-4 py-3">
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
        </div>
      )}

      {/* Topic progress bars (returning users) */}
      {hasGoals && intakeStep === "idle" && (activeGoals ?? []).length > 1 && (
        <div className="mt-6 px-6 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Topics
            </h2>
            <div className="space-y-2">
              {activeGoals!.slice(1).map((goal) => (
                <Link
                  key={goal.id}
                  href={`/learn/${goal.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/30 px-4 py-2.5 transition-all hover:border-border/50"
                >
                  <span className="flex-1 text-sm font-medium">{goal.title}</span>
                  <div className="flex w-24 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${goal.totalItems > 0 ? (goal.completedItems / goal.totalItems) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {goal.totalItems > 0
                        ? Math.round((goal.completedItems / goal.totalItems) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero + conversational intake */}
      <div
        className={cn(
          "flex flex-col items-center px-6 pb-8 text-center",
          hasGoals && intakeStep === "idle" ? "pt-8" : "pt-16 lg:pt-20"
        )}
      >
        {intakeStep === "idle" && (
          <>
            {!hasGoals && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                What do you want to learn?
              </h1>
            )}
            {hasGoals && (
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Learn something new
              </h2>
            )}

            {error && (
              <div className="mt-3 w-full max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Chat input */}
            <div className="mt-4 flex w-full max-w-xl items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-2.5 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md">
              <Sparkles className="size-4 text-muted-foreground/40" />
              <input
                type="text"
                placeholder="Learn anything..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startIntake(chatInput)}
                className="flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <button
                onClick={() => startIntake(chatInput)}
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

            {/* Upload buttons (secondary) */}
            {!hasGoals && (
              <div className="mt-4 flex items-center gap-3 text-[12px] text-muted-foreground">
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
            )}

            {/* Popular topics */}
            {!hasGoals && (
              <div className="mt-8 w-full max-w-xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Popular starting points
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {POPULAR_TOPICS.map((topic) => (
                    <button
                      key={topic.title}
                      onClick={() => startPopularTopic(topic.title)}
                      className="flex flex-col items-start rounded-xl border border-border/30 bg-card px-4 py-3 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                    >
                      <span className="text-sm font-medium">{topic.title}</span>
                      <span className="text-[11px] text-muted-foreground/60">{topic.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Conversational intake: Goal selection */}
        {intakeStep === "goal" && (
          <div className="w-full max-w-xl text-left">
            <button
              onClick={resetIntake}
              className="mb-4 text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <div className="mb-3 rounded-lg bg-muted/30 px-4 py-2 text-sm">
              <span className="text-muted-foreground">You:</span>{" "}
              <span className="font-medium">{selectedTopic}</span>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <p className="text-sm font-(family-name:--font-source-serif)">
                Great topic. What brings you to <strong>{selectedTopic}</strong>?
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => selectGoal(opt.id)}
                    className="flex items-center gap-2 rounded-lg border border-border/30 px-4 py-2.5 text-sm font-medium transition-all hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversational intake: Level selection */}
        {intakeStep === "level" && (
          <div className="w-full max-w-xl text-left">
            <button
              onClick={resetIntake}
              className="mb-4 text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <div className="mb-2 rounded-lg bg-muted/30 px-4 py-2 text-sm">
              <span className="text-muted-foreground">You:</span>{" "}
              <span className="font-medium">{selectedTopic}</span>
            </div>
            <div className="mb-3 rounded-lg bg-muted/30 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Goal:</span>{" "}
              <span className="font-medium">
                {GOAL_OPTIONS.find((o) => o.id === selectedGoal)?.icon}{" "}
                {GOAL_OPTIONS.find((o) => o.id === selectedGoal)?.label}
              </span>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <p className="text-sm font-(family-name:--font-source-serif)">
                How familiar are you with <strong>{selectedTopic}</strong>?
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => selectLevel(opt.id)}
                    disabled={generating}
                    className="flex items-center gap-2 rounded-lg border border-border/30 px-4 py-2.5 text-sm font-medium transition-all hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generating state */}
        {intakeStep === "generating" && (
          <div className="flex w-full max-w-xl flex-col items-center gap-4 pt-8">
            <div className="relative">
              <GraduationCap className="size-10 text-primary" />
              <Loader2 className="absolute -right-2 -top-2 size-5 animate-spin text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Building your learning path...</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Creating a personalized curriculum for {selectedTopic}
              </p>
            </div>
          </div>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} defaultTab={uploadTab} />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
