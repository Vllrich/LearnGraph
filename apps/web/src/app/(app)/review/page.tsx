"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type TouchEvent as ReactTouchEvent } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Zap,
  Trophy,
  ChevronRight,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Timer,
  Shuffle,
  MessageSquare,
  Send,
  Sparkles,
  RotateCcw,
  Brain,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { QueueMode } from "@repo/shared";

type ReviewQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  options: string[] | null;
  correctAnswer: string | null;
  explanation: string | null;
  difficulty: number | null;
  conceptIds: string[] | null;
};

const MASTERY_LABELS = ["Unseen", "Exposed", "Familiar", "Practiced", "Solid", "Mastered"];
const MASTERY_COLORS = [
  "bg-[hsl(var(--mastery-0))]",
  "bg-[hsl(var(--mastery-1))]",
  "bg-[hsl(var(--mastery-2))]",
  "bg-[hsl(var(--mastery-3))]",
  "bg-[hsl(var(--mastery-4))]",
  "bg-[hsl(var(--mastery-5))]",
];

const MODE_OPTIONS: { id: QueueMode; label: string; icon: typeof Zap; desc: string }[] = [
  { id: "standard", label: "Standard", icon: Zap, desc: "Full daily queue" },
  { id: "quick_5", label: "Quick 5", icon: Timer, desc: "5-card micro session" },
  { id: "interleaved", label: "Interleaved", icon: Shuffle, desc: "Mixed domains" },
];

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const conceptParam = searchParams.get("concept");

  const [mode, setMode] = useState<QueueMode>("standard");
  const [modeChosen, setModeChosen] = useState(!!conceptParam);

  const { data, isLoading } = trpc.review.getDailyQueue.useQuery({ mode }, { enabled: modeChosen });
  const submitMutation = trpc.review.submitReview.useMutation();
  const explainBackMutation = trpc.review.submitExplainBack.useMutation();
  const rateMutation = trpc.library.rateQuestion.useMutation();
  const activityMutation = trpc.gamification.recordActivity.useMutation();
  const utils = trpc.useUtils();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });
  const [sessionComplete, setSessionComplete] = useState(false);
  const startTimeRef = useRef(0);

  // Explain-back state
  const [explainBackMode, setExplainBackMode] = useState(false);
  const [explainBackText, setExplainBackText] = useState("");
  const [explainBackResult, setExplainBackResult] = useState<{
    success: boolean;
    evaluation: {
      accuracy: number;
      completeness: number;
      clarity: number;
      overallScore: number;
      strengths: string[];
      improvements: string[];
      misconceptions: string[];
      feedback: string;
    };
    newMastery: number;
  } | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [currentIndex]);

  const allQuestions = (data?.questions ?? []) as ReviewQuestion[];
  const allItems = data?.items ?? [];
  const hasQuestionsForReview = allQuestions.length > 0;

  // Self-rating mode: items exist but no quiz questions available
  const [selfRateIndex, setSelfRateIndex] = useState(0);
  const [selfRateFlipped, setSelfRateFlipped] = useState(false);
  const [selfRateExiting, setSelfRateExiting] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const useSelfRating = !hasQuestionsForReview && allItems.length > 0 && modeChosen;
  const currentQuestion = allQuestions[currentIndex];
  const shuffledOptions = useMemo(() => {
    const opts = Array.isArray(currentQuestion?.options) ? [...(currentQuestion.options as string[])] : [];
    // Seeded shuffle based on question id to keep order stable across re-renders
    const seed = currentQuestion?.id
      ? currentQuestion.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : 0;
    for (let i = opts.length - 1; i > 0; i--) {
      const j = (seed + i) % (i + 1);
      [opts[i], opts[j]] = [opts[j]!, opts[i]!];
    }
    return opts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);
  const currentSelfRateItem = allItems[selfRateIndex];
  const totalQuestions = useSelfRating ? allItems.length : allQuestions.length;
  const currentIdx = useSelfRating ? selfRateIndex : currentIndex;
  const progress = totalQuestions > 0 ? (currentIdx / totalQuestions) * 100 : 0;

  const isExplainBackEligible =
    currentQuestion && data?.explainBackEligible?.includes(currentQuestion.conceptIds?.[0] ?? "");

  const handleSubmit = useCallback(() => {
    if (!currentQuestion || !selectedAnswer) return;
    setShowResult(true);
  }, [currentQuestion, selectedAnswer]);

  const advanceToNext = useCallback(() => {
    if (currentIndex + 1 >= totalQuestions) {
      setSessionComplete(true);
      utils.review.getDailyQueue.invalidate();
      utils.review.getStats.invalidate();
      utils.gamification.getStreakAndXp.invalidate();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
      setExplainBackMode(false);
      setExplainBackText("");
      setExplainBackResult(null);
    }
  }, [currentIndex, totalQuestions, utils]);

  const handleRate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!currentQuestion) return;

      const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
      const conceptId = currentQuestion.conceptIds?.[0];
      if (!conceptId) return;

      await submitMutation.mutateAsync({
        conceptId,
        rating,
        questionId: currentQuestion.id,
        answerText: selectedAnswer ?? undefined,
        isCorrect,
        responseTimeMs: Date.now() - startTimeRef.current,
      });

      activityMutation.mutate({ type: "review" });

      setSessionResults((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));

      advanceToNext();
    },
    [currentQuestion, selectedAnswer, submitMutation, activityMutation, advanceToNext]
  );

  const handleExplainBackSubmit = useCallback(async () => {
    const conceptId = currentQuestion?.conceptIds?.[0];
    if (!conceptId || !explainBackText.trim()) return;

    const result = await explainBackMutation.mutateAsync({
      conceptId,
      explanation: explainBackText,
    });

    if (result.success !== undefined) {
      setExplainBackResult(result as typeof explainBackResult);
      activityMutation.mutate({
        type: result.success ? "explain_back_success" : "explain_back_attempt",
      });
      setSessionResults((prev) => ({
        correct: prev.correct + (result.success ? 1 : 0),
        total: prev.total + 1,
      }));
    }
  }, [currentQuestion, explainBackText, explainBackMutation, activityMutation]);

  // Self-rating flashcard handlers (must be before early returns)
  const handleSelfRate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!currentSelfRateItem || submitMutation.isPending) return;
      const direction = rating >= 3 ? "right" : "left";
      setSelfRateExiting(direction);

      await submitMutation.mutateAsync({
        conceptId: currentSelfRateItem.conceptId,
        rating,
        responseTimeMs: Date.now() - startTimeRef.current,
      });
      activityMutation.mutate({ type: "review" });
      setSessionResults((prev) => ({
        correct: prev.correct + (rating >= 3 ? 1 : 0),
        total: prev.total + 1,
      }));

      setTimeout(() => {
        setSelfRateFlipped(false);
        setSelfRateExiting(null);
        if (cardRef.current) cardRef.current.style.transform = "";
        if (selfRateIndex + 1 >= allItems.length) {
          setSessionComplete(true);
          utils.review.getDailyQueue.invalidate();
          utils.review.getStats.invalidate();
          utils.gamification.getStreakAndXp.invalidate();
        } else {
          setSelfRateIndex((i) => i + 1);
        }
      }, 280);
    },
    [currentSelfRateItem, submitMutation, activityMutation, selfRateIndex, allItems.length, utils]
  );

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchDeltaRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!touchStartRef.current || !cardRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    touchDeltaRef.current = dx;
    const rotate = dx * 0.06;
    const opacity = Math.max(0.5, 1 - Math.abs(dx) / 400);
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
    cardRef.current.style.opacity = `${opacity}`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!cardRef.current) return;
    const dx = touchDeltaRef.current;
    const threshold = 100;

    if (!selfRateFlipped) {
      cardRef.current.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      cardRef.current.style.transform = "";
      cardRef.current.style.opacity = "1";
      setTimeout(() => {
        if (cardRef.current) cardRef.current.style.transition = "";
      }, 260);
    } else if (Math.abs(dx) > threshold) {
      handleSelfRate(dx > 0 ? 4 : 1);
    } else {
      cardRef.current.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      cardRef.current.style.transform = "";
      cardRef.current.style.opacity = "1";
      setTimeout(() => {
        if (cardRef.current) cardRef.current.style.transition = "";
      }, 260);
    }
    touchStartRef.current = null;
  }, [selfRateFlipped, handleSelfRate]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (sessionComplete || explainBackMode) return;
      if (e.key === "Enter" && !showResult && selectedAnswer) {
        e.preventDefault();
        handleSubmit();
      }
      if (showResult && !submitMutation.isPending) {
        const rating = parseInt(e.key) as 1 | 2 | 3 | 4;
        if (rating >= 1 && rating <= 4) {
          e.preventDefault();
          handleRate(rating);
        }
      }
      if (e.key === "h" && !showResult) setShowHint(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Mode selection screen
  if (!modeChosen) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
          <Link
            href="/"
            className="text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="text-[13px] font-medium">Review</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <h1 className="text-lg font-medium mb-1">Choose your session</h1>
          <p className="text-[13px] text-muted-foreground/60 mb-6">
            Pick a review mode that fits your schedule
          </p>
          <div className="grid gap-3 w-full max-w-sm">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMode(opt.id);
                    setModeChosen(true);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border/30 p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted/40">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground/50">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || (allQuestions.length === 0 && allItems.length === 0)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center px-6">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-green-500/10">
          <Check className="size-6 text-green-500" />
        </div>
        <h1 className="text-lg font-medium">All caught up!</h1>
        <p className="mt-1 text-[13px] text-muted-foreground/60">
          No concepts due for review. Upload more content or check back later.
        </p>
        <Link href="/" className="mt-4 text-[13px] text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  if (sessionComplete) {
    const accuracy =
      sessionResults.total > 0
        ? Math.round((sessionResults.correct / sessionResults.total) * 100)
        : 0;

    return (
      <div className="flex h-screen flex-col items-center justify-center text-center px-6">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
          <Trophy className="size-6 text-amber-500" />
        </div>
        <h1 className="text-lg font-medium">Session complete!</h1>
        {mode === "quick_5" && (
          <p className="text-[12px] text-muted-foreground/50 mt-1">Quick 5 — done in a flash</p>
        )}
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-2xl font-bold">{sessionResults.correct}</p>
            <p className="text-[11px] text-muted-foreground">Correct</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{sessionResults.total}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{accuracy}%</p>
            <p className="text-[11px] text-muted-foreground">Accuracy</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => {
              setModeChosen(false);
              setSessionComplete(false);
              setCurrentIndex(0);
              setSessionResults({ correct: 0, total: 0 });
            }}
            className="rounded-lg border border-border/30 px-4 py-2 text-[13px] font-medium hover:bg-muted/20"
          >
            Another session
          </button>
          <Link
            href="/"
            className="flex items-center gap-1 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background"
          >
            Done <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Explain-back mode
  if (explainBackMode) {
    const conceptName = currentQuestion?.conceptIds?.[0]
      ? data.items.find((i) => i.conceptId === currentQuestion.conceptIds![0])?.conceptName
      : "this concept";

    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
          <button
            onClick={() => {
              setExplainBackMode(false);
              setExplainBackResult(null);
              setExplainBackText("");
            }}
            className="text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-3.5 text-violet-500" />
            <span className="text-[13px] font-medium">Explain Back</span>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="w-full max-w-lg">
            {!explainBackResult ? (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="size-4 text-violet-500" />
                  <span className="text-[12px] text-muted-foreground/50">
                    Teach it to learn it — explain as if to a beginner
                  </span>
                </div>
                <h2 className="text-[16px] font-medium leading-relaxed mb-4">
                  Explain <span className="text-primary">{conceptName}</span> in your own words
                </h2>
                <textarea
                  value={explainBackText}
                  onChange={(e) => setExplainBackText(e.target.value)}
                  placeholder="Type your explanation here... What is this concept? How does it work? Why does it matter?"
                  rows={6}
                  className="w-full rounded-xl border border-border/30 bg-transparent px-4 py-3 text-[13px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none resize-none"
                />
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground/40">
                    {explainBackText.length} characters · minimum 10
                  </span>
                  <button
                    onClick={handleExplainBackSubmit}
                    disabled={explainBackText.length < 10 || explainBackMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:opacity-30 transition-opacity"
                  >
                    {explainBackMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Submit
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "mb-4 rounded-xl border p-4",
                    explainBackResult.success
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {explainBackResult.success ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Lightbulb className="size-4 text-amber-500" />
                    )}
                    <span className="text-[13px] font-medium">
                      {explainBackResult.success
                        ? "Great explanation!"
                        : "Good attempt — keep learning!"}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground/70">
                    {explainBackResult.evaluation.feedback}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "Accuracy", value: explainBackResult.evaluation.accuracy },
                    { label: "Completeness", value: explainBackResult.evaluation.completeness },
                    { label: "Clarity", value: explainBackResult.evaluation.clarity },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/30 p-2.5 text-center"
                    >
                      <p className="text-lg font-bold">{value}%</p>
                      <p className="text-[10px] text-muted-foreground/50">{label}</p>
                    </div>
                  ))}
                </div>

                {explainBackResult.evaluation.strengths.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-medium text-green-600 dark:text-green-400 mb-1">
                      Strengths
                    </p>
                    {explainBackResult.evaluation.strengths.map((s, i) => (
                      <p key={i} className="text-[12px] text-muted-foreground/60">
                        • {s}
                      </p>
                    ))}
                  </div>
                )}

                {explainBackResult.evaluation.improvements.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mb-1">
                      Areas to improve
                    </p>
                    {explainBackResult.evaluation.improvements.map((s, i) => (
                      <p key={i} className="text-[12px] text-muted-foreground/60">
                        • {s}
                      </p>
                    ))}
                  </div>
                )}

                {explainBackResult.evaluation.misconceptions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mb-1">
                      Misconceptions
                    </p>
                    {explainBackResult.evaluation.misconceptions.map((s, i) => (
                      <p key={i} className="text-[12px] text-muted-foreground/60">
                        • {s}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={advanceToNext}
                  className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (useSelfRating && !sessionComplete && currentSelfRateItem) {
    const item = currentSelfRateItem;
    const mastery = item.masteryLevel ?? 0;

    return (
      <div className="flex h-dvh flex-col bg-background">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
          <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1">
            <div className="mx-auto max-w-md">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                  {selfRateIndex + 1} / {allItems.length}
                </span>
                <div className="h-1 flex-1 rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
            Self-Rate
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4">
          {/* Flip card */}
          <div
            className="w-full max-w-md"
            style={{ perspective: "1200px" }}
          >
            <div
              ref={cardRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => !selfRateFlipped && setSelfRateFlipped(true)}
              className={cn(
                "relative w-full cursor-pointer select-none transition-all duration-500",
                selfRateExiting === "left" && "translate-x-[-120%] -rotate-12 opacity-0",
                selfRateExiting === "right" && "translate-x-[120%] rotate-12 opacity-0",
              )}
              style={{
                transformStyle: "preserve-3d",
                ...(selfRateFlipped && !selfRateExiting ? { transform: "rotateY(180deg)" } : {}),
              }}
            >
              {/* Front face */}
              <div
                className="rounded-2xl border border-border/40 bg-card shadow-sm p-6 min-h-[320px] flex flex-col"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    {item.domain && (
                      <span className="rounded-full bg-primary/8 px-2.5 py-0.5 text-[10px] font-medium text-primary/70">
                        {item.domain}
                      </span>
                    )}
                    <span className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white",
                      MASTERY_COLORS[mastery] ?? MASTERY_COLORS[0],
                    )}>
                      <Brain className="size-2.5" />
                      {MASTERY_LABELS[mastery]}
                    </span>
                  </div>
                  {item.conceptDifficulty != null && (
                    <span className="text-[10px] text-muted-foreground/40">
                      Lvl {item.conceptDifficulty}/5
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <BookOpen className="size-5 text-muted-foreground/20 mb-3" />
                  <h2 className="text-xl font-semibold leading-tight tracking-tight">
                    {item.conceptName}
                  </h2>
                  <p className="mt-3 text-[13px] text-muted-foreground/40 leading-relaxed max-w-xs">
                    What do you know about this concept?
                  </p>
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-4 text-muted-foreground/30">
                  <RotateCcw className="size-3" />
                  <span className="text-[11px]">Tap to flip</span>
                </div>
              </div>

              {/* Back face */}
              <div
                className="absolute inset-0 rounded-2xl border border-border/40 bg-card shadow-sm p-6 min-h-[320px] flex flex-col"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5 text-primary/60">
                    <Lightbulb className="size-3.5" />
                    <span className="text-[11px] font-medium">Definition</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelfRateFlipped(false); }}
                    className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-[15px] font-semibold mb-3">{item.conceptName}</h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground/70">
                    {item.conceptDefinition ?? "No definition available for this concept yet."}
                  </p>
                </div>

                <p className="text-center text-[10px] text-muted-foreground/30 mt-3 md:hidden">
                  Swipe right = knew it · Swipe left = didn&apos;t
                </p>
              </div>
            </div>
          </div>

          {/* Rating buttons (visible after flip) */}
          <div
            className={cn(
              "w-full max-w-md mt-5 transition-all duration-300",
              selfRateFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
            )}
          >
            <p className="text-center text-[11px] text-muted-foreground/40 mb-2.5">
              How well did you know this?
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { rating: 1, label: "Again", sublabel: "<1d", color: "text-red-500", border: "hover:border-red-500/40" },
                  { rating: 2, label: "Hard", sublabel: "~3d", color: "text-orange-500", border: "hover:border-orange-500/40" },
                  { rating: 3, label: "Good", sublabel: "~7d", color: "text-blue-500", border: "hover:border-blue-500/40" },
                  { rating: 4, label: "Easy", sublabel: "~14d", color: "text-green-500", border: "hover:border-green-500/40" },
                ] as const
              ).map(({ rating, label, sublabel, color, border }) => (
                <button
                  key={rating}
                  onClick={() => handleSelfRate(rating)}
                  disabled={submitMutation.isPending}
                  className={cn(
                    "rounded-xl border border-border/30 py-3 text-center transition-all hover:bg-muted/20 active:scale-95",
                    border,
                  )}
                >
                  <p className={cn("text-[13px] font-medium", color)}>{label}</p>
                  <p className="text-[10px] text-muted-foreground/40">{sublabel}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const options = shuffledOptions;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <div className="mx-auto max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                {currentIndex + 1} / {totalQuestions}
              </span>
              <div className="h-1 flex-1 rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        {mode === "quick_5" && (
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-500">
            Quick 5
          </span>
        )}
        {mode === "interleaved" && (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
            Interleaved
          </span>
        )}
        <Zap className="size-4 text-muted-foreground/30" />
      </header>

      {/* Question area */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg">
          {currentQuestion?.difficulty && (
            <span className="mb-3 inline-block rounded-full bg-muted/40 px-2.5 py-0.5 text-[10px] text-muted-foreground/50">
              Difficulty {currentQuestion.difficulty}/5
            </span>
          )}

          <h2 className="text-[16px] font-medium leading-relaxed">
            {currentQuestion?.questionText}
          </h2>

          {/* MCQ options */}
          {currentQuestion?.questionType === "mcq" && options.length > 0 && (
            <div className="mt-5 space-y-2">
              {options.map((opt, i) => {
                const isSelected = selectedAnswer === opt;
                const isCorrectOption = showResult && opt === currentQuestion.correctAnswer;
                const isWrongSelection = showResult && isSelected && !isCorrectOption;

                return (
                  <button
                    key={i}
                    onClick={() => !showResult && setSelectedAnswer(opt)}
                    disabled={showResult}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left text-[13px] transition-all",
                      isCorrectOption
                        ? "border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-400"
                        : isWrongSelection
                          ? "border-red-500/50 bg-red-500/5 text-red-700 dark:text-red-400"
                          : isSelected
                            ? "border-foreground/30 bg-muted/30"
                            : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                    )}
                  >
                    <span className="mr-2 text-muted-foreground/40">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                    {isCorrectOption && <Check className="float-right mt-0.5 size-4" />}
                    {isWrongSelection && <X className="float-right mt-0.5 size-4" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Short answer / fill blank */}
          {currentQuestion?.questionType !== "mcq" && (
            <div className="mt-5">
              <input
                type="text"
                value={selectedAnswer ?? ""}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                disabled={showResult}
                placeholder="Type your answer..."
                className="w-full rounded-xl border border-border/30 bg-transparent px-4 py-3 text-[13px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
              />
            </div>
          )}

          {/* Hint */}
          {!showResult && showHint && currentQuestion?.explanation && (
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="size-3 text-amber-500" />
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Hint
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground/70">
                {currentQuestion.explanation.split(".").slice(0, 1).join(".")}.
              </p>
            </div>
          )}

          {/* Submit or result */}
          {!showResult ? (
            <div className="mt-5 flex gap-2">
              {!showHint && (
                <button
                  onClick={() => setShowHint(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-border/30 px-4 py-3 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
                  title="Press H for hint"
                >
                  <Lightbulb className="size-3.5" />
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!selectedAnswer}
                className="flex-1 rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-20 transition-opacity"
              >
                Submit <span className="text-[11px] opacity-50 ml-1">Enter</span>
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {currentQuestion?.explanation && (
                <div className="rounded-xl bg-muted/20 px-4 py-3">
                  <p className="text-[12px] leading-relaxed text-muted-foreground/70">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {currentQuestion && (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-[10px] text-muted-foreground/30">Rate this question:</span>
                  <button
                    onClick={() => {
                      rateMutation.mutate({ questionId: currentQuestion.id, feedback: "up" });
                      toast.success("Thanks for the feedback!");
                    }}
                    className="text-muted-foreground/30 hover:text-green-500 transition-colors"
                  >
                    <ThumbsUp className="size-3" />
                  </button>
                  <button
                    onClick={() => {
                      rateMutation.mutate({ questionId: currentQuestion.id, feedback: "down" });
                      toast.success("Feedback noted — we'll improve it.");
                    }}
                    className="text-muted-foreground/30 hover:text-red-500 transition-colors"
                  >
                    <ThumbsDown className="size-3" />
                  </button>
                </div>
              )}

              {/* Explain-back CTA for high-mastery concepts */}
              {isExplainBackEligible && (
                <button
                  onClick={() => setExplainBackMode(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 py-2.5 text-[12px] font-medium text-violet-600 dark:text-violet-400 transition-all hover:bg-violet-500/10"
                >
                  <MessageSquare className="size-3.5" />
                  Explain this concept for a mastery boost
                </button>
              )}

              <p className="text-center text-[11px] text-muted-foreground/40">
                How well did you know this?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { rating: 1, label: "Again", sublabel: "<1d", color: "text-red-500" },
                    { rating: 2, label: "Hard", sublabel: "~3d", color: "text-orange-500" },
                    { rating: 3, label: "Good", sublabel: "~7d", color: "text-blue-500" },
                    { rating: 4, label: "Easy", sublabel: "~14d", color: "text-green-500" },
                  ] as const
                ).map(({ rating, label, sublabel, color }) => (
                  <button
                    key={rating}
                    onClick={() => handleRate(rating)}
                    disabled={submitMutation.isPending}
                    className="rounded-xl border border-border/30 py-2.5 text-center transition-all hover:border-border/60 hover:bg-muted/20"
                  >
                    <p className={cn("text-[12px] font-medium", color)}>{label}</p>
                    <p className="text-[10px] text-muted-foreground/40">{sublabel}</p>
                    <p className="text-[9px] text-muted-foreground/25 mt-0.5">{rating}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
