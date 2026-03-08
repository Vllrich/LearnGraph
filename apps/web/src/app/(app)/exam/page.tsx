"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  Loader2,
  Clock,
  Trophy,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

type ExamQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  options: string[] | null;
  correctAnswer: string | null;
  explanation: string | null;
  difficulty: number | null;
  conceptIds: string[] | null;
  learningObjectTitle: string;
};

type AnswerRecord = {
  questionId: string;
  selected: string;
  correct: boolean;
};

const GOAL_GRADIENTS = [
  "from-violet-600 to-indigo-500",
  "from-blue-600 to-cyan-500",
  "from-emerald-600 to-teal-500",
  "from-orange-500 to-amber-400",
  "from-rose-600 to-pink-500",
  "from-purple-600 to-violet-500",
];

function goalGradient(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  return GOAL_GRADIENTS[Math.abs(hash) % GOAL_GRADIENTS.length];
}

export default function PracticeExamPage() {
  const [started, setStarted] = useState(false);
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);

  const { data: goalsData, isLoading: goalsLoading } = trpc.goals.getActive.useQuery(undefined, {
    enabled: !started,
  });
  const activeGoals = goalsData ?? [];

  const { data, isLoading, error } = trpc.review.getPracticeExam.useQuery(
    {
      questionCount,
      timeLimitMinutes: timeLimit,
      goalIds: selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
    },
    { enabled: started, retry: false }
  );

  const submitMutation = trpc.review.submitReview.useMutation();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [examComplete, setExamComplete] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const examStartedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const allQuestions = (data?.questions ?? []) as ExamQuestion[];
  const currentQuestion = allQuestions[currentIndex];
  const totalQuestions = allQuestions.length;

  const totalSeconds = data ? data.timeLimitMinutes * 60 : 0;
  const timeRemaining = Math.max(0, totalSeconds - elapsed);

  useEffect(() => {
    if (!started || !data || examComplete) return;

    // Initialize start timestamps on first tick
    if (examStartedAtRef.current === null) {
      examStartedAtRef.current = Date.now();
      startTimeRef.current = Date.now();
    }

    timerRef.current = setInterval(() => {
      if (examStartedAtRef.current === null) return;
      const newElapsed = Math.floor((Date.now() - examStartedAtRef.current) / 1000);
      setElapsed(newElapsed);

      if (newElapsed >= totalSeconds) {
        clearInterval(timerRef.current!);
        setExamComplete(true);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, data, examComplete, totalSeconds]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleNext = useCallback(() => {
    if (!currentQuestion || !selectedAnswer) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    const record: AnswerRecord = {
      questionId: currentQuestion.id,
      selected: selectedAnswer,
      correct: isCorrect,
    };

    setAnswers((prev) => [...prev, record]);

    const conceptId = currentQuestion.conceptIds?.[0];
    if (conceptId) {
      submitMutation.mutate({
        conceptId,
        rating: isCorrect ? 3 : 1,
        questionId: currentQuestion.id,
        answerText: selectedAnswer,
        isCorrect,
        responseTimeMs: Date.now() - startTimeRef.current,
      });
    }

    if (currentIndex + 1 >= totalQuestions) {
      setExamComplete(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      startTimeRef.current = Date.now();
    }
  }, [currentQuestion, selectedAnswer, currentIndex, totalQuestions, submitMutation]);

  const handleSkip = useCallback(() => {
    if (!currentQuestion) return;
    setAnswers((prev) => [
      ...prev,
      { questionId: currentQuestion.id, selected: "", correct: false },
    ]);

    if (currentIndex + 1 >= totalQuestions) {
      setExamComplete(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
    }
  }, [currentQuestion, currentIndex, totalQuestions]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (examComplete || !started) return;
      if (e.key === "Enter" && selectedAnswer) {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [examComplete, started, selectedAnswer, handleNext]);

  const toggleGoal = (id: string) => {
    setSelectedGoalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetExam = () => {
    setExamComplete(false);
    setStarted(false);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setShowReview(false);
    setElapsed(0);
    setSelectedGoalIds([]);
    examStartedAtRef.current = null;
  };

  // ─── Setup screen ───
  if (!started) {
    return (
      <div className="px-4 pt-16 lg:pt-20">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight font-(family-name:--font-source-serif)">
                Practice Exam
              </h1>
              <p className="text-[13px] text-muted-foreground/60">
                Simulate real exam conditions — timed, no hints, no immediate feedback.
              </p>
            </div>
          </div>

          {/* Course selector */}
          <div className="mt-8">
            <label className="text-[13px] font-medium text-muted-foreground">
              Courses{" "}
              {selectedGoalIds.length > 0 && (
                <span className="text-primary">({selectedGoalIds.length} selected)</span>
              )}
            </label>
            <p className="mt-0.5 text-[11px] text-muted-foreground/50">
              Select courses to draw questions from, or leave empty for all.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {goalsLoading ? (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
                </div>
              ) : activeGoals.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-border/40 py-8 text-center">
                  <p className="text-[13px] text-muted-foreground/40">
                    No courses yet. Start a course from the home page first.
                  </p>
                </div>
              ) : (
                activeGoals.map((goal) => {
                  const isSelected = selectedGoalIds.includes(goal.id);
                  const pct =
                    goal.totalItems > 0
                      ? Math.round((goal.completedItems / goal.totalItems) * 100)
                      : 0;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                        isSelected
                          ? "border-primary/30 bg-primary/5 shadow-sm"
                          : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                      )}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="size-5 shrink-0 text-primary" />
                      ) : (
                        <div
                          className={cn(
                            "size-5 shrink-0 rounded-md bg-linear-to-br",
                            goalGradient(goal.title)
                          )}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{goal.title}</p>
                        <p className="text-[11px] text-muted-foreground/50">
                          {goal.completedItems}/{goal.totalItems} concepts · {pct}%
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-medium text-muted-foreground">Questions</label>
              <div className="mt-2 flex gap-2">
                {[10, 20, 30, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={cn(
                      "flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-all",
                      questionCount === n
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-medium text-muted-foreground">Time Limit</label>
              <div className="mt-2 flex gap-2">
                {[15, 30, 60, 120].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTimeLimit(n)}
                    className={cn(
                      "flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-all",
                      timeLimit === n
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                    )}
                  >
                    {n}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-border/30 px-6 py-3 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
            >
              Back
            </Link>
            <button
              onClick={() => setStarted(true)}
              disabled={!goalsLoading && activeGoals.length === 0}
              className="flex-1 rounded-xl bg-foreground py-3 text-[14px] font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading / error ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4 pt-32">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pt-16 lg:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-red-500/10">
            <AlertTriangle className="size-5 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            {error.message || "Failed to load exam questions. Please try again."}
          </p>
          <button
            onClick={resetExam}
            className="mt-5 rounded-xl border border-border/30 px-6 py-2.5 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="px-4 pt-16 lg:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <AlertTriangle className="size-5 text-amber-500" />
          </div>
          <h1 className="text-lg font-semibold">Not enough questions</h1>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            {selectedGoalIds.length > 0
              ? "The selected courses don't have enough questions yet. Try selecting more courses or study more content."
              : "Upload and study more content to build up your question bank."}
          </p>
          <button
            onClick={resetExam}
            className="mt-5 rounded-xl border border-border/30 px-6 py-2.5 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ─── Results screen ───
  if (examComplete) {
    const correctCount = answers.filter((a) => a.correct).length;
    const skippedCount = answers.filter((a) => a.selected === "").length;
    const wrongCount = answers.length - correctCount - skippedCount;
    const accuracy = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
    const timeUsed = elapsed;

    return (
      <div className="px-4 pt-16 pb-12 lg:pt-20">
        <div className="mx-auto w-full max-w-2xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <Trophy className="size-6 text-amber-500" />
            </div>
            <h1 className="text-2xl font-semibold font-(family-name:--font-source-serif)">
              Exam Complete
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground/60">
              Time used: {formatTime(timeUsed)} / {data!.timeLimitMinutes}m
            </p>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-3 text-center">
            <div className="rounded-xl border border-border/30 bg-card py-4 shadow-sm">
              <p className="text-3xl font-bold">{accuracy}%</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Score</p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 py-4">
              <p className="text-3xl font-bold text-green-500">{correctCount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-xl border border-red-400/20 bg-red-500/5 py-4">
              <p className="text-3xl font-bold text-red-400">{wrongCount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Wrong</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-muted/10 py-4">
              <p className="text-3xl font-bold text-muted-foreground">{skippedCount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Skipped</p>
            </div>
          </div>

          <button
            onClick={() => setShowReview((v) => !v)}
            className="mt-8 w-full rounded-xl border border-border/30 px-4 py-3 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
          >
            {showReview ? "Hide" : "Review"} Answers
          </button>

          {showReview && (
            <div className="mt-4 space-y-2">
              {allQuestions.map((q, i) => {
                const answer = answers[i];
                if (!answer) return null;
                const isCorrect = answer.correct;
                const wasSkipped = answer.selected === "";

                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-[13px]",
                      isCorrect
                        ? "border-green-500/20 bg-green-500/5"
                        : wasSkipped
                          ? "border-border/30 bg-muted/10"
                          : "border-red-500/20 bg-red-500/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      ) : (
                        <X className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{q.questionText}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/40">
                          From: {q.learningObjectTitle}
                        </p>
                        {!isCorrect && q.correctAnswer && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Correct: {q.correctAnswer}
                          </p>
                        )}
                        {!isCorrect && q.explanation && (
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <Link
              href="/"
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border/30 py-3 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
            >
              Done
            </Link>
            <button
              onClick={resetExam}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-foreground py-3 text-[13px] font-medium text-background transition-opacity hover:opacity-80"
            >
              Retake <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Exam in progress ───
  const options = Array.isArray(currentQuestion?.options)
    ? (currentQuestion.options as string[])
    : [];

  const isLowTime = timeRemaining < 60;
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen">
      {/* Sticky exam header with progress + timer */}
      <div className="sticky top-12 z-10 border-b border-border/30 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground/60">
            {currentIndex + 1}/{totalQuestions}
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-mono tabular-nums",
              isLowTime ? "bg-red-500/10 text-red-500 animate-pulse" : "text-muted-foreground"
            )}
          >
            <Clock className="size-3" />
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-10 pb-12">
        <div className="mb-3 flex items-center gap-2">
          {currentQuestion?.difficulty && (
            <span className="rounded-full bg-muted/40 px-2.5 py-0.5 text-[10px] text-muted-foreground/50">
              Difficulty {currentQuestion.difficulty}/5
            </span>
          )}
          <span className="rounded-full bg-muted/30 px-2.5 py-0.5 text-[10px] text-muted-foreground/40">
            {currentQuestion?.learningObjectTitle}
          </span>
        </div>

        <h2 className="text-lg font-medium leading-relaxed">{currentQuestion?.questionText}</h2>

        {currentQuestion?.questionType === "mcq" && options.length > 0 && (
          <div className="mt-6 space-y-2">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(opt)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3.5 text-left text-[14px] transition-all",
                  selectedAnswer === opt
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                )}
              >
                <span className="mr-2.5 inline-flex size-6 items-center justify-center rounded-md bg-muted/40 text-[12px] font-medium text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        )}

        {currentQuestion?.questionType !== "mcq" && (
          <div className="mt-6">
            <input
              type="text"
              value={selectedAnswer ?? ""}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full rounded-xl border border-border/30 bg-transparent px-4 py-3.5 text-[14px] placeholder:text-muted-foreground/30 focus:border-primary/30 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={handleSkip}
            className="rounded-xl border border-border/30 px-5 py-3 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            disabled={!selectedAnswer}
            className="flex-1 rounded-xl bg-foreground py-3 text-[13px] font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-20"
          >
            {currentIndex + 1 >= totalQuestions ? "Finish" : "Next"}
            <span className="ml-1.5 text-[11px] opacity-50">Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
