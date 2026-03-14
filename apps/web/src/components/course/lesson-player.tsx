"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Send,
  Lightbulb,
  BookOpen,
  MessageCircle,
  Target,
  PenLine,
  HelpCircle,
  Sparkles,
  BookMarked,
  PanelLeftClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MarkdownContent } from "@/components/course/markdown-content";
import { useReadingMode } from "@/contexts/reading-mode";
import type { BlockType } from "@repo/shared";

type LessonPlayerProps = {
  goalId: string;
  lessonId: string;
};

const BLOCK_ICONS: Record<BlockType, typeof BookOpen> = {
  concept: BookOpen,
  worked_example: Lightbulb,
  checkpoint: Target,
  practice: PenLine,
  reflection: MessageCircle,
  scenario: Sparkles,
  mentor: HelpCircle,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  concept: "Concept",
  worked_example: "Worked Example",
  checkpoint: "Quick Check",
  practice: "Practice",
  reflection: "Reflection",
  scenario: "Scenario",
  mentor: "Mentor",
};

type StreamState = "idle" | "streaming" | "done";

export function LessonPlayer({ goalId, lessonId }: LessonPlayerProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = trpc.goals.getLessonBlocks.useQuery({ lessonId });
  const completeMutation = trpc.goals.completeBlock.useMutation();
  const { readingMode, setReadingMode } = useReadingMode();

  // Enter reading mode by default when lesson player mounts
  useEffect(() => {
    setReadingMode(true);
    return () => setReadingMode(false);
  }, [setReadingMode]);

  const [blockIndex, setBlockIndex] = useState(0);
  const [streamedContent, setStreamedContent] = useState("");
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [checkResult, setCheckResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [scenarioResult, setScenarioResult] = useState<{ outcome: string; isOptimal: boolean; debrief: string } | null>(null);
  const [blockTransition, setBlockTransition] = useState(false);
  const blockStartTime = useRef(Date.now());
  const [blocksCompletedThisSession, setBlocksCompletedThisSession] = useState(0);

  const blocks = data?.blocks ?? [];
  const currentBlock = blocks[blockIndex];
  const totalBlocks = blocks.length;
  const progressPercent = totalBlocks > 0 ? Math.round((blockIndex / totalBlocks) * 100) : 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedContent, feedback, checkResult]);

  // Stream content from the V2 session API
  const streamBlock = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      if (!currentBlock) return;
      setStreamState("streaming");
      setStreamedContent("");
      setBlockError(null);

      try {
        const res = await fetch("/api/learn/session-v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            blockId: currentBlock.id,
            goalId,
            ...extra,
          }),
        });

        if (!res.ok || !res.body) {
          setBlockError("Failed to load this block. You can skip to the next one.");
          setStreamState("done");
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
              if (data.type === "text") {
                setStreamedContent((prev) => prev + data.text);
              }
            } catch { /* ignore */ }
          }
        }
      } catch {
        setBlockError("Network error. You can skip to the next block.");
      }
      setStreamState("done");
    },
    [currentBlock, goalId],
  );

  // Auto-start streaming for concept/worked_example blocks
  useEffect(() => {
    if (!currentBlock || streamState !== "idle") return;

    const type = currentBlock.blockType as BlockType;
    if (type === "concept") {
      void streamBlock("stream_concept");
    } else if (type === "worked_example") {
      void streamBlock("stream_worked_example");
    } else if (type === "checkpoint") {
      // Checkpoints are JSON, not streamed
      void fetchCheckpoint();
    } else if (type === "reflection") {
      void streamBlock("stream_reflection_prompt");
    } else if (type === "scenario") {
      void fetchScenario();
    } else if (type === "mentor") {
      void streamBlock("stream_mentor");
    } else if (type === "practice") {
      // Show practice exercise from generated content
      const content = currentBlock.generatedContent as Record<string, unknown>;
      setStreamedContent(content.exercise as string ?? "Complete this exercise.");
      setStreamState("done");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock, blockIndex]);

  async function fetchCheckpoint() {
    if (!currentBlock) return;
    try {
      const res = await fetch("/api/learn/session-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_checkpoint",
          blockId: currentBlock.id,
          goalId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeedback(JSON.stringify(data.questions));
      } else {
        setBlockError("Failed to load checkpoint. You can skip to the next block.");
      }
    } catch {
      setBlockError("Network error loading checkpoint.");
    }
    setStreamState("done");
  }

  async function fetchScenario() {
    if (!currentBlock) return;
    try {
      const res = await fetch("/api/learn/session-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_scenario",
          blockId: currentBlock.id,
          goalId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStreamedContent(data.narrative ?? "");
        setFeedback(JSON.stringify(data.decisions));
      } else {
        setBlockError("Failed to load scenario. You can skip to the next block.");
      }
    } catch {
      setBlockError("Network error loading scenario.");
    }
    setStreamState("done");
  }

  async function handleCheckpointSubmit() {
    if (!currentBlock || !selectedAnswer) return;
    try {
      const res = await fetch("/api/learn/session-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_checkpoint",
          blockId: currentBlock.id,
          goalId,
          userAnswer: selectedAnswer,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckResult({ correct: data.correct, explanation: data.explanation });
      }
    } catch { /* */ }
  }

  async function handleReflectionSubmit() {
    if (!currentBlock || !userInput.trim()) return;
    setStreamState("streaming");
    try {
      const res = await fetch("/api/learn/session-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_reflection",
          blockId: currentBlock.id,
          goalId,
          userAnswer: userInput,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeedback(JSON.stringify(data.score));
      }
    } catch { /* */ }
    setStreamState("done");
  }

  async function handleScenarioChoice(choiceIndex: number) {
    if (!currentBlock) return;
    try {
      const res = await fetch("/api/learn/session-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_scenario_choice",
          blockId: currentBlock.id,
          goalId,
          choiceIndex,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScenarioResult(data);
      }
    } catch { /* */ }
  }

  async function handlePracticeSubmit() {
    if (!currentBlock || !userInput.trim()) return;
    setStreamedContent("");
    await streamBlock("stream_practice_feedback", { userAnswer: userInput });
  }

  function advanceToNext() {
    if (!currentBlock) return;

    const timeSpentMs = Date.now() - blockStartTime.current;
    completeMutation.mutate({
      blockId: currentBlock.id,
      interactionLog: {
        timeSpentMs,
        blockType: currentBlock.blockType,
        hintsUsed: hintsRevealed,
        correct: checkResult?.correct,
        completedAt: new Date().toISOString(),
      },
    });

    setBlocksCompletedThisSession((c) => c + 1);

    const nextIndex = blockIndex + 1;
    if (nextIndex >= totalBlocks) {
      router.push(`/course/${goalId}`);
      return;
    }

    setBlockTransition(true);
    setTimeout(() => {
      setBlockIndex(nextIndex);
      setStreamedContent("");
      setStreamState("idle");
      setBlockError(null);
      setUserInput("");
      setFeedback(null);
      setSelectedAnswer("");
      setCheckResult(null);
      setHintsRevealed(0);
      setScenarioResult(null);
      blockStartTime.current = Date.now();
      setBlockTransition(false);
    }, 200);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || blocks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No blocks found for this lesson.</p>
        <Button variant="outline" onClick={() => router.push(`/course/${goalId}`)}>
          Back to Course
        </Button>
      </div>
    );
  }

  const blockType = (currentBlock?.blockType ?? "concept") as BlockType;
  const BlockIcon = BLOCK_ICONS[blockType];
  const content = (currentBlock?.generatedContent ?? {}) as Record<string, unknown>;

  const renderCheckpointQuestions = () => {
    if (!feedback) return null;
    let questions: Array<{
      type: string;
      question: string;
      options?: string[];
      correctIndex?: number;
      explanation: string;
    }>;
    try { questions = JSON.parse(feedback); } catch { return null; }
    const q = questions[0];
    if (!q) return null;

    return (
      <div className="mt-6 rounded-xl border border-border/50 bg-muted/20 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick check</p>
        <p className="mb-4 text-sm font-medium">{q.question}</p>

        {q.type === "mcq" && q.options ? (
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(String(i))}
                disabled={!!checkResult}
                className={cn(
                  "w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-all",
                  selectedAnswer === String(i)
                    ? "border-primary bg-primary/5"
                    : "border-border/30 hover:border-border/60",
                  checkResult && i === q.correctIndex && "border-green-500 bg-green-500/5",
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
            disabled={!!checkResult}
            className="w-full resize-none rounded-lg border border-border/30 bg-background px-4 py-2.5 text-sm focus:border-primary/40 focus:outline-none"
          />
        )}

        {!checkResult && (
          <Button className="mt-4" size="sm" onClick={handleCheckpointSubmit} disabled={!selectedAnswer}>
            Check Answer
          </Button>
        )}

        {checkResult && (
          <div className="mt-4 space-y-2">
            <div className={cn(
              "rounded-lg px-3 py-2 text-sm",
              checkResult.correct ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}>
              {checkResult.correct ? "Correct!" : "Not quite."}
            </div>
            <p className="text-sm text-muted-foreground">{checkResult.explanation}</p>
          </div>
        )}
      </div>
    );
  };

  const renderPracticeHints = () => {
    const hints = content.hints as string[] | undefined;
    if (!hints?.length) return null;

    // Scaffold fading: reduce visible hints as session mastery grows
    // After 3+ blocks completed, show fewer hints; after 8+, show at most 1
    const maxHints = blocksCompletedThisSession >= 8
      ? Math.min(1, hints.length)
      : blocksCompletedThisSession >= 3
        ? Math.min(Math.ceil(hints.length / 2), hints.length)
        : hints.length;

    const visibleHints = hints.slice(0, maxHints);

    return (
      <div className="mt-3">
        {hintsRevealed < visibleHints.length && (
          <button
            onClick={() => setHintsRevealed((h) => h + 1)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground"
          >
            <Lightbulb className="size-3" />
            Show hint ({hintsRevealed + 1}/{visibleHints.length})
          </button>
        )}
        {visibleHints.slice(0, hintsRevealed).map((hint, i) => (
          <p key={i} className="mt-1 rounded-lg bg-amber-500/5 px-3 py-1.5 text-[12px] text-amber-700 dark:text-amber-400">
            Hint {i + 1}: {hint}
          </p>
        ))}
        {maxHints < hints.length && hintsRevealed >= visibleHints.length && (
          <p className="mt-1 text-[10px] text-muted-foreground/40 italic">
            Fewer hints shown as you gain mastery
          </p>
        )}
      </div>
    );
  };

  const canContinue =
    !!blockError ||
    ((blockType === "concept" || blockType === "worked_example") && streamState === "done") ||
    (blockType === "checkpoint" && !!checkResult) ||
    (blockType === "practice" && streamState === "done" && streamedContent.length > 0 && userInput.length > 0) ||
    (blockType === "reflection" && feedback !== null) ||
    (blockType === "scenario" && !!scenarioResult) ||
    (blockType === "mentor" && streamState === "done");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/20 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-2.5">
          <button
            onClick={() => {
              setReadingMode(false);
              router.push(`/course/${goalId}`);
            }}
            className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            title="Back to course"
          >
            <ArrowLeft className="size-4" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="truncate text-[13px] font-medium text-foreground/80">{data.lesson.title}</p>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/50">
              <span>{blockIndex + 1} of {totalBlocks}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <BlockIcon className="size-3" />
                {BLOCK_LABELS[blockType]}
              </span>
            </div>
          </div>

          <button
            onClick={() => setReadingMode(!readingMode)}
            title={readingMode ? "Exit reading mode" : "Reading mode"}
            className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          >
            {readingMode ? <PanelLeftClose className="size-4" /> : <BookMarked className="size-4" />}
          </button>
        </div>
        <Progress value={progressPercent} className="h-0.5 rounded-none" />
      </header>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={cn(
          "mx-auto max-w-2xl px-6 py-12 sm:px-8 transition-all duration-300",
          blockTransition ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
        )}>
          {/* Error state */}
          {blockError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {blockError}
            </div>
          )}

          {/* Streamed text content */}
          {streamedContent && (blockType === "concept" || blockType === "worked_example" || blockType === "mentor") && (
            <div>
              <MarkdownContent text={streamedContent} />
              {streamState === "streaming" && (
                <span className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-0.5 animate-pulse bg-foreground/70" />
              )}
            </div>
          )}

          {/* Checkpoint questions */}
          {blockType === "checkpoint" && renderCheckpointQuestions()}

          {/* Practice exercise */}
          {blockType === "practice" && (
            <div className="space-y-4">
              {streamedContent && <MarkdownContent text={streamedContent} />}
              {renderPracticeHints()}
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Write your solution..."
                rows={5}
                className="w-full resize-none rounded-lg border border-border/30 bg-background px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
              />
              <Button size="sm" onClick={handlePracticeSubmit} disabled={!userInput.trim() || streamState === "streaming"}>
                Submit Solution
              </Button>
            </div>
          )}

          {/* Reflection */}
          {blockType === "reflection" && (
            <div className="space-y-4">
              {streamedContent && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                  <MarkdownContent text={streamedContent} />
                </div>
              )}
              {streamState === "done" && !feedback && (
                <>
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Write your reflection..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-border/30 bg-background px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
                  />
                  <Button size="sm" className="gap-1.5" onClick={handleReflectionSubmit} disabled={!userInput.trim()}>
                    <Send className="size-3" />
                    Submit
                  </Button>
                </>
              )}
              {feedback && (
                <div className="rounded-lg bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                  Reflection submitted. Well done!
                </div>
              )}
            </div>
          )}

          {/* Scenario */}
          {blockType === "scenario" && (
            <div className="space-y-4">
              {streamedContent && <MarkdownContent text={streamedContent} />}
              {feedback && !scenarioResult && (() => {
                let decisions: Array<{ prompt: string; options: Array<{ label: string }> }>;
                try { decisions = JSON.parse(feedback); } catch { return null; }
                const d = decisions[0];
                if (!d) return null;
                return (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
                    <p className="mb-3 text-sm font-medium">{d.prompt}</p>
                    <div className="space-y-2">
                      {d.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleScenarioChoice(i)}
                          className="w-full rounded-lg border border-border/30 px-4 py-2.5 text-left text-sm transition-colors hover:border-border/60 hover:bg-muted/30"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {scenarioResult && (
                <div className="space-y-3">
                  <div className={cn(
                    "rounded-lg px-4 py-3 text-sm",
                    scenarioResult.isOptimal ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  )}>
                    {scenarioResult.outcome}
                  </div>
                  <MarkdownContent text={scenarioResult.debrief} className="text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Mentor interaction */}
          {blockType === "mentor" && streamState === "done" && (
            <div className="mt-4 space-y-3">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Share your thoughts..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border/30 bg-background px-4 py-3 text-sm focus:border-primary/40 focus:outline-none"
              />
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => streamBlock("stream_mentor", { userAnswer: userInput })}
                disabled={!userInput.trim()}
              >
                <Send className="size-3" />
                Respond
              </Button>
            </div>
          )}

          {/* Continue button */}
          {canContinue && (
            <div className="mt-10">
              <Button onClick={advanceToNext} className="gap-1.5">
                {blockIndex + 1 >= totalBlocks ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Complete Lesson
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

