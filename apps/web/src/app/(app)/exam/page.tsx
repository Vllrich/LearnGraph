"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Clock,
  Trophy,
  ChevronRight,
  AlertTriangle,
  FileText,
  Youtube,
  Globe,
  Presentation,
  FileAudio,
  Image as ImageIcon,
  FileType2,
  CheckCircle2,
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

const SOURCE_ICONS: Record<string, typeof FileText> = {
  youtube: Youtube,
  url: Globe,
  pptx: Presentation,
  docx: FileType2,
  audio: FileAudio,
  image: ImageIcon,
};

function getSourceIcon(sourceType: string) {
  return SOURCE_ICONS[sourceType] ?? FileText;
}

export default function PracticeExamPage() {
  const [started, setStarted] = useState(false);
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30);
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);

  const { data: libraryData } = trpc.library.list.useQuery(
    { limit: 100, offset: 0 },
    { enabled: !started }
  );
  const readyMaterials = useMemo(
    () => (libraryData?.items ?? []).filter((lo) => lo.status === "ready"),
    [libraryData?.items]
  );

  const { data, isLoading, error } = trpc.review.getPracticeExam.useQuery(
    {
      questionCount,
      timeLimitMinutes: timeLimit,
      learningObjectIds: selectedLOs.length > 0 ? selectedLOs : undefined,
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

  const toggleLO = (id: string) => {
    setSelectedLOs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resetExam = () => {
    setExamComplete(false);
    setStarted(false);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setShowReview(false);
    setElapsed(0);
    examStartedAtRef.current = null;
  };

  // ─── Setup screen ───
  if (!started) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <h1 className="text-xl font-semibold tracking-tight">Practice Exam</h1>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            Simulate real exam conditions — timed, no hints, no immediate feedback.
          </p>

          {/* Material selector */}
          <div className="mt-6">
            <label className="text-[12px] font-medium text-muted-foreground">
              Materials {selectedLOs.length > 0 && `(${selectedLOs.length} selected)`}
            </label>
            <p className="mt-0.5 text-[11px] text-muted-foreground/50">
              Select specific materials or leave empty to use all.
            </p>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/30 p-2">
              {readyMaterials.length === 0 ? (
                <p className="px-2 py-4 text-center text-[12px] text-muted-foreground/40">
                  No materials available yet. Upload content first.
                </p>
              ) : (
                readyMaterials.map((lo) => {
                  const Icon = getSourceIcon(lo.sourceType);
                  const isSelected = selectedLOs.includes(lo.id);
                  return (
                    <button
                      key={lo.id}
                      onClick={() => toggleLO(lo.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        isSelected
                          ? "bg-primary/5 text-foreground"
                          : "text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground"
                      )}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <Icon className="size-3.5 shrink-0 text-muted-foreground/40" />
                      )}
                      <span className="truncate text-[12px]">{lo.title}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Questions</label>
              <div className="mt-1.5 flex gap-2">
                {[10, 20, 30, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-[13px] transition-all",
                      questionCount === n
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/30 hover:border-border/60"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground">
                Time Limit (minutes)
              </label>
              <div className="mt-1.5 flex gap-2">
                {[15, 30, 60, 120].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTimeLimit(n)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-[13px] transition-all",
                      timeLimit === n
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/30 hover:border-border/60"
                    )}
                  >
                    {n}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStarted(true)}
            disabled={readyMaterials.length === 0}
            className="mt-8 w-full rounded-xl bg-foreground py-3 text-[14px] font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            Start Exam
          </button>

          <Link
            href="/"
            className="mt-3 block text-center text-[12px] text-muted-foreground/50 hover:text-muted-foreground"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ─── Loading / error ───
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="size-6 text-red-500 mb-3" />
        <h1 className="text-lg font-medium">Something went wrong</h1>
        <p className="mt-1 text-[13px] text-muted-foreground/60">
          {error.message || "Failed to load exam questions. Please try again."}
        </p>
        <button onClick={resetExam} className="mt-4 text-[13px] text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="size-6 text-amber-500 mb-3" />
        <h1 className="text-lg font-medium">Not enough questions</h1>
        <p className="mt-1 text-[13px] text-muted-foreground/60">
          {selectedLOs.length > 0
            ? "The selected materials don't have enough questions yet. Try selecting more materials."
            : "Upload and study more content to build up your question bank."}
        </p>
        <button onClick={resetExam} className="mt-4 text-[13px] text-primary hover:underline">
          Go back
        </button>
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
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center">
            <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <Trophy className="size-6 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold">Exam Complete</h1>
            <p className="mt-1 text-[13px] text-muted-foreground/60">
              Time used: {formatTime(timeUsed)} / {data!.timeLimitMinutes}m
            </p>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-3 text-center">
            <div className="rounded-xl border border-border/30 py-3">
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-[10px] text-muted-foreground">Score</p>
            </div>
            <div className="rounded-xl border border-border/30 py-3">
              <p className="text-2xl font-bold text-green-500">{correctCount}</p>
              <p className="text-[10px] text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-xl border border-border/30 py-3">
              <p className="text-2xl font-bold text-red-400">{wrongCount}</p>
              <p className="text-[10px] text-muted-foreground">Wrong</p>
            </div>
            <div className="rounded-xl border border-border/30 py-3">
              <p className="text-2xl font-bold text-muted-foreground">{skippedCount}</p>
              <p className="text-[10px] text-muted-foreground">Skipped</p>
            </div>
          </div>

          <button
            onClick={() => setShowReview((v) => !v)}
            className="mt-6 w-full rounded-xl border border-border/30 px-4 py-2.5 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
          >
            {showReview ? "Hide" : "Review"} Answers
          </button>

          {showReview && (
            <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
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

          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border/30 py-2.5 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
            >
              Done
            </Link>
            <button
              onClick={resetExam}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-foreground py-2.5 text-[13px] font-medium text-background"
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
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/30 px-4">
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
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-mono tabular-nums",
            isLowTime
              ? "bg-red-500/10 text-red-500 animate-pulse"
              : "bg-muted/30 text-muted-foreground"
          )}
        >
          <Clock className="size-3" />
          {formatTime(timeRemaining)}
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg">
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

          <h2 className="text-[16px] font-medium leading-relaxed">
            {currentQuestion?.questionText}
          </h2>

          {currentQuestion?.questionType === "mcq" && options.length > 0 && (
            <div className="mt-5 space-y-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAnswer(opt)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left text-[13px] transition-all",
                    selectedAnswer === opt
                      ? "border-foreground/30 bg-muted/30"
                      : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                  )}
                >
                  <span className="mr-2 text-muted-foreground/40">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQuestion?.questionType !== "mcq" && (
            <div className="mt-5">
              <input
                type="text"
                value={selectedAnswer ?? ""}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="w-full rounded-xl border border-border/30 bg-transparent px-4 py-3 text-[13px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
              />
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              onClick={handleSkip}
              className="rounded-xl border border-border/30 px-4 py-3 text-[13px] text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/20"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedAnswer}
              className="flex-1 rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-20 transition-opacity"
            >
              {currentIndex + 1 >= totalQuestions ? "Finish" : "Next"}{" "}
              <span className="text-[11px] opacity-50 ml-1">Enter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
