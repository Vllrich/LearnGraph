"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";

export function QuizzesTab({ learningObjectId }: { learningObjectId: string }) {
  const { data: questionList, isLoading } = trpc.library.getQuestions.useQuery({
    learningObjectId,
  });
  const submitMutation = trpc.review.submitReview.useMutation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!questionList || questionList.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[13px] font-medium text-foreground/70">No quizzes yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">
          Quizzes are auto-generated during ingestion. They&apos;ll appear here once ready.
        </p>
      </div>
    );
  }

  const q = questionList[currentIdx];
  if (!q) return null;

  const options = Array.isArray(q.options) ? (q.options as string[]) : [];
  const isCorrect = selected === q.correctAnswer;

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    const conceptId = q.conceptIds?.[0];
    if (!conceptId) return;

    await submitMutation.mutateAsync({
      conceptId,
      rating,
      questionId: q.id,
      answerText: selected ?? undefined,
      isCorrect,
    });

    setSelected(null);
    setRevealed(false);
    setCurrentIdx((i) => (i + 1) % questionList.length);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/40 tabular-nums">
          {currentIdx + 1} / {questionList.length}
        </span>
        {q.difficulty && (
          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground/50">
            Difficulty {q.difficulty}/5
          </span>
        )}
      </div>

      <p className="text-[13px] font-medium leading-relaxed">{q.questionText}</p>

      {q.questionType === "mcq" && options.length > 0 ? (
        <div className="space-y-1.5">
          {options.map((opt, i) => {
            const isSel = selected === opt;
            const isRight = revealed && opt === q.correctAnswer;
            const isWrong = revealed && isSel && !isRight;
            return (
              <button
                key={i}
                onClick={() => !revealed && setSelected(opt)}
                disabled={revealed}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-[12px] transition-all",
                  isRight
                    ? "border-green-500/50 bg-green-500/5 text-green-600 dark:text-green-400"
                    : isWrong
                      ? "border-red-500/50 bg-red-500/5 text-red-600 dark:text-red-400"
                      : isSel
                        ? "border-foreground/30 bg-muted/30"
                        : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                )}
              >
                <span className="mr-1.5 text-muted-foreground/40">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          disabled={revealed}
          placeholder="Type your answer..."
          className="w-full rounded-lg border border-border/30 bg-transparent px-3 py-2 text-[12px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
        />
      )}

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          disabled={!selected}
          className="w-full rounded-lg bg-foreground py-2 text-[12px] font-medium text-background disabled:opacity-20 transition-opacity"
        >
          Check Answer
        </button>
      ) : (
        <div className="space-y-3">
          {q.explanation && (
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                {q.explanation}
              </p>
            </div>
          )}
          <p className="text-center text-[10px] text-muted-foreground/40">
            How well did you know this?
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { rating: 1 as const, label: "Again", color: "text-red-500" },
              { rating: 2 as const, label: "Hard", color: "text-orange-500" },
              { rating: 3 as const, label: "Good", color: "text-blue-500" },
              { rating: 4 as const, label: "Easy", color: "text-green-500" },
            ].map(({ rating, label, color }) => (
              <button
                key={rating}
                onClick={() => handleRate(rating)}
                disabled={submitMutation.isPending}
                className="rounded-lg border border-border/30 py-1.5 text-center transition-all hover:border-border/60 hover:bg-muted/20"
              >
                <p className={cn("text-[11px] font-medium", color)}>{label}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
