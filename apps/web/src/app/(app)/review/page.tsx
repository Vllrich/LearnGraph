"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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

export default function ReviewPage() {
  const { data, isLoading } = trpc.review.getDailyQueue.useQuery();
  const submitMutation = trpc.review.submitReview.useMutation();
  const rateMutation = trpc.library.rateQuestion.useMutation();
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

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [currentIndex]);

  const allQuestions = (data?.questions ?? []) as ReviewQuestion[];
  const currentQuestion = allQuestions[currentIndex];
  const totalQuestions = allQuestions.length;
  const progress = totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;

  const handleSubmit = useCallback(() => {
    if (!currentQuestion || !selectedAnswer) return;
    setShowResult(true);
  }, [currentQuestion, selectedAnswer]);

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

      setSessionResults((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));

      if (currentIndex + 1 >= totalQuestions) {
        setSessionComplete(true);
        utils.review.getDailyQueue.invalidate();
        utils.review.getStats.invalidate();
      } else {
        setCurrentIndex((i) => i + 1);
        setSelectedAnswer(null);
        setShowResult(false);
        setShowHint(false);
      }
    },
    [
      currentQuestion,
      selectedAnswer,
      currentIndex,
      totalQuestions,
      submitMutation,
      startTimeRef,
      utils,
    ]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (sessionComplete) return;
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
      if (e.key === "h" && !showResult) {
        setShowHint(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || allQuestions.length === 0) {
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
        <Link
          href="/"
          className="mt-6 flex items-center gap-1 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background"
        >
          Done <ChevronRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  const options = Array.isArray(currentQuestion?.options)
    ? (currentQuestion.options as string[])
    : [];

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
              {/* Explanation */}
              {currentQuestion?.explanation && (
                <div className="rounded-xl bg-muted/20 px-4 py-3">
                  <p className="text-[12px] leading-relaxed text-muted-foreground/70">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* FSRS rating buttons */}
              {/* Question feedback */}
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
