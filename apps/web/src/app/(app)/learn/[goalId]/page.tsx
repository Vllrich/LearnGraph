"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  Send,
  List,
  Circle,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { GoalType, LearnerLevel } from "@repo/shared";

type Phase =
  | "teach"
  | "check"
  | "answering"
  | "feedback"
  | "explain_back_prompt"
  | "explain_back_input"
  | "explain_back_result"
  | "session_complete";

type QuestionData = {
  type: "mcq" | "short_answer";
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
};

type ExplainBackScore = {
  correct: string[];
  partial: string[];
  missing: string[];
  rating: number;
};

type ConceptResult = {
  title: string;
  correct: boolean;
  explainBackRating?: number;
};

export default function LearnSessionPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.goalId as string;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: goalData, isLoading } = trpc.goals.getById.useQuery({ id: goalId });
  const completeMutation = trpc.goals.completeCurriculumItem.useMutation();

  const [conceptIndex, setConceptIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("teach");
  const [teachContent, setTeachContent] = useState("");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [explainBackPromptText, setExplainBackPromptText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [explainBackInput, setExplainBackInput] = useState("");
  const [explainBackScore, setExplainBackScore] = useState<ExplainBackScore | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [conceptResults, setConceptResults] = useState<ConceptResult[]>([]);
  const [previousConcepts, setPreviousConcepts] = useState<string[]>([]);

  const items = goalData?.items ?? [];
  const currentItem = items[conceptIndex];
  const totalConcepts = items.length;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [teachContent, feedbackContent, phase, scrollToBottom]);

  const buildRequestBody = useCallback(
    (action: string, extra?: Record<string, unknown>) => ({
      action,
      goalId,
      topic: goalData?.title ?? "",
      goalType: (goalData?.goalType ?? "exploration") as GoalType,
      currentLevel: (goalData?.currentLevel ?? "beginner") as LearnerLevel,
      conceptTitle: currentItem?.title ?? "",
      conceptDescription: currentItem?.description ?? "",
      conceptIndex,
      totalConcepts,
      previousConcepts,
      ...extra,
    }),
    [goalId, goalData, currentItem, conceptIndex, totalConcepts, previousConcepts]
  );

  const streamFromSSE = useCallback(
    async (body: Record<string, unknown>, onText: (t: string) => void) => {
      setStreaming(true);
      const res = await fetch("/api/learn/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") onText(data.text);
          } catch {
            /* ignore parse errors */
          }
        }
      }
      setStreaming(false);
    },
    []
  );

  const startTeaching = useCallback(async () => {
    if (!currentItem) return;
    setPhase("teach");
    setTeachContent("");
    setFeedbackContent("");
    setCurrentQuestion(null);
    setSelectedAnswer("");
    setExplainBackInput("");
    setExplainBackScore(null);
    setExplainBackPromptText("");
    setCheckFailed(false);

    await streamFromSSE(buildRequestBody("teach"), (text) => {
      setTeachContent((prev) => prev + text);
    });

    setPhase("check");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const checkRes = await fetch("/api/learn/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody("check")),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.question) {
          setCurrentQuestion({
            ...data.question,
            question: data.question.question ?? data.question.text ?? "Check your understanding:",
          });
          return;
        }
      }
      setCheckFailed(true);
    } catch {
      setCheckFailed(true);
    }
  }, [currentItem, buildRequestBody, streamFromSSE]);

  useEffect(() => {
    if (goalData && items.length > 0 && phase === "teach" && !teachContent) {
      startTeaching();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalData]);

  const handleAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return;
    setPhase("answering");

    const isCorrect =
      currentQuestion.type === "mcq"
        ? selectedAnswer === String(currentQuestion.correctIndex)
        : true;

    setFeedbackContent("");
    setPhase("feedback");

    await streamFromSSE(
      buildRequestBody("answer", {
        userAnswer: selectedAnswer,
        question: currentQuestion,
      }),
      (text) => {
        setFeedbackContent((prev) => prev + text);
      }
    );

    setConceptResults((prev) => [...prev, { title: currentItem?.title ?? "", correct: isCorrect }]);

    if (currentItem) {
      completeMutation.mutate({ itemId: currentItem.id });
    }
  };

  const shouldExplainBack =
    conceptIndex > 0 &&
    conceptIndex % 2 === 0 &&
    (goalData?.goalType ?? "exploration") !== "exploration";

  const handleContinue = async () => {
    if (currentItem && phase === "check") {
      completeMutation.mutate({ itemId: currentItem.id });
      setConceptResults((prev) => [...prev, { title: currentItem.title ?? "", correct: true }]);
    }

    if (shouldExplainBack && (phase === "feedback" || phase === "check")) {
      setExplainBackPromptText("");
      setPhase("explain_back_prompt");
      await streamFromSSE(buildRequestBody("explain_back_prompt"), (text) => {
        setExplainBackPromptText((prev) => prev + text);
      });
      setPhase("explain_back_input");
      return;
    }

    advanceToNext();
  };

  const handleExplainBackSubmit = async () => {
    if (!explainBackInput.trim()) return;
    setPhase("explain_back_result");

    const res = await fetch("/api/learn/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildRequestBody("explain_back_answer", { userAnswer: explainBackInput })
      ),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.score) {
        setExplainBackScore(data.score);
        setConceptResults((prev) => {
          const last = prev[prev.length - 1];
          if (last) {
            return [...prev.slice(0, -1), { ...last, explainBackRating: data.score.rating }];
          }
          return prev;
        });
      }
    }
  };

  const advanceToNext = () => {
    const nextIndex = conceptIndex + 1;
    setPreviousConcepts((prev) => [...prev, currentItem?.title ?? ""]);

    if (nextIndex >= totalConcepts) {
      setPhase("session_complete");
      return;
    }

    setConceptIndex(nextIndex);
    setPhase("teach");
    setTeachContent("");
    setFeedbackContent("");
    setCurrentQuestion(null);
    setSelectedAnswer("");
    setExplainBackInput("");
    setExplainBackScore(null);
    setExplainBackPromptText("");
    setCheckFailed(false);

    setTimeout(() => startTeaching(), 100);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!goalData || items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No curriculum found.</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  const progressPercent = Math.round(
    ((conceptIndex + (phase === "session_complete" ? 1 : 0)) / totalConcepts) * 100
  );

  if (phase === "session_complete") {
    const correctCount = conceptResults.filter((r) => r.correct).length;
    const needsReview = conceptResults.filter((r) => !r.correct).length;

    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Session Complete</h1>
        <div className="mt-6 flex items-center gap-6 text-center">
          <div>
            <p className="text-3xl font-bold">{totalConcepts}</p>
            <p className="text-xs text-muted-foreground">concepts</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-500">{correctCount}</p>
            <p className="text-xs text-muted-foreground">correct</p>
          </div>
          {needsReview > 0 && (
            <div>
              <p className="text-3xl font-bold text-amber-500">{needsReview}</p>
              <p className="text-xs text-muted-foreground">review</p>
            </div>
          )}
        </div>

        <div className="mt-8 w-full space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What you learned
          </h2>
          {conceptResults.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border/30 px-4 py-2.5"
            >
              {r.correct ? (
                <CheckCircle2 className="size-4 text-green-500" />
              ) : (
                <AlertTriangle className="size-4 text-amber-500" />
              )}
              <span className="flex-1 text-sm">{r.title}</span>
              {r.explainBackRating != null && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Star
                      key={j}
                      className={cn(
                        "size-3",
                        j < r.explainBackRating!
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="outline" onClick={() => router.push("/")}>
            Done for today
          </Button>
          <Button onClick={() => router.push("/review")}>Review weak spots</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/30 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium">{goalData.title}</p>
            <p className="text-xs text-muted-foreground">
              {conceptIndex + 1} of {totalConcepts} concepts
              {currentItem && ` — ${currentItem.title}`}
            </p>
          </div>
          <button
            onClick={() => setChaptersOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <List className="size-3.5" />
            {progressPercent}%
          </button>
        </div>
        <Progress value={progressPercent} className="h-1 rounded-none" />
      </header>

      {/* Session content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {/* Teaching content */}
          {teachContent && (
            <div className="prose prose-sm dark:prose-invert max-w-none font-(family-name:--font-source-serif)">
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(teachContent) }} />
              {streaming && phase === "teach" && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
              )}
            </div>
          )}

          {/* Check loading / fallback */}
          {phase === "check" && !currentQuestion && (
            <div className="mt-8 rounded-xl border border-border/50 bg-muted/20 p-5">
              {checkFailed ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Could not generate a quiz question.
                  </p>
                  <Button className="mt-3" size="sm" onClick={handleContinue}>
                    Continue to next concept
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Generating a quick check...
                </div>
              )}
            </div>
          )}

          {/* Quick check */}
          {(phase === "check" || phase === "answering") && currentQuestion && (
            <div className="mt-8 rounded-xl border border-border/50 bg-muted/20 p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick check
              </p>
              <p className="mb-4 text-sm font-medium">{currentQuestion.question}</p>

              {currentQuestion.type === "mcq" && currentQuestion.options ? (
                <div className="space-y-2">
                  {currentQuestion.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedAnswer(String(i))}
                      disabled={phase === "answering"}
                      className={cn(
                        "w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-all",
                        selectedAnswer === String(i)
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border/30 hover:border-border/60"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border/30 bg-background px-4 py-2.5 text-sm focus:border-primary/40 focus:outline-none"
                />
              )}

              <Button
                className="mt-4"
                size="sm"
                onClick={handleAnswer}
                disabled={!selectedAnswer || phase === "answering"}
              >
                {phase === "answering" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Check Answer"
                )}
              </Button>
            </div>
          )}

          {/* Feedback */}
          {phase === "feedback" && feedbackContent && (
            <div className="mt-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(feedbackContent) }} />
                {streaming && (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
                )}
              </div>
              {!streaming && (
                <Button className="mt-4" size="sm" onClick={handleContinue}>
                  Continue
                </Button>
              )}
            </div>
          )}

          {/* Explain-back prompt */}
          {(phase === "explain_back_prompt" || phase === "explain_back_input") && (
            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
              {explainBackPromptText && (
                <div className="prose prose-sm dark:prose-invert mb-4 max-w-none font-(family-name:--font-source-serif)">
                  <div
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(explainBackPromptText) }}
                  />
                </div>
              )}
              {phase === "explain_back_input" && (
                <>
                  <textarea
                    value={explainBackInput}
                    onChange={(e) => setExplainBackInput(e.target.value)}
                    placeholder="Type your explanation..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-border/30 bg-background px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
                  />
                  <Button className="mt-3 gap-1.5" size="sm" onClick={handleExplainBackSubmit}>
                    <Send className="size-3" />
                    Submit explanation
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Explain-back result */}
          {phase === "explain_back_result" && explainBackScore && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium">Here&apos;s how you did:</p>
              {explainBackScore.correct.map((item, i) => (
                <div key={`c-${i}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                  <span>{item}</span>
                </div>
              ))}
              {explainBackScore.partial.map((item, i) => (
                <div key={`p-${i}`} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <span>{item}</span>
                </div>
              ))}
              {explainBackScore.missing.map((item, i) => (
                <div key={`m-${i}`} className="flex items-start gap-2 text-sm">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                  <span>Missing: {item}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 pt-2">
                <span className="text-xs text-muted-foreground">Understanding:</span>
                {Array.from({ length: 5 }, (_, j) => (
                  <Star
                    key={j}
                    className={cn(
                      "size-3.5",
                      j < explainBackScore.rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <Button className="mt-4" size="sm" onClick={advanceToNext}>
                Got it, continue
              </Button>
            </div>
          )}

          {/* Loading explain-back result */}
          {phase === "explain_back_result" && !explainBackScore && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Evaluating your explanation...
            </div>
          )}
        </div>
      </div>

      {/* Chapters slide-over */}
      {chaptersOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setChaptersOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <aside
            className="absolute right-0 top-0 h-full w-80 border-l border-border/30 bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <h2 className="text-sm font-semibold">Chapters</h2>
              <button
                onClick={() => setChaptersOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XCircle className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-2 py-3" style={{ maxHeight: "calc(100vh - 52px)" }}>
              {items.map((item, i) => {
                const isCurrent = i === conceptIndex;
                const isCompleted = i < conceptIndex;
                const isLocked = i > conceptIndex;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                      isCurrent && "bg-primary/5",
                      isCompleted && "opacity-70"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="size-4 text-green-500" />
                      ) : isCurrent ? (
                        <CircleDot className="size-4 text-primary" />
                      ) : isLocked ? (
                        <Circle className="size-4 text-muted-foreground/30" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13px] font-medium leading-tight",
                          isLocked && "text-muted-foreground/50",
                          isCurrent && "text-primary"
                        )}
                      >
                        {i + 1}. {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {item.estimatedMinutes && (
                      <span className="shrink-0 text-[10px] text-muted-foreground/50">
                        {item.estimatedMinutes}m
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mt-4 mb-1">$1</h2>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
