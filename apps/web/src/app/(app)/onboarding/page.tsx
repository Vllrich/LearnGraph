"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const updateMutation = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Welcome to LearnGraph!");
      router.push("/");
    },
  });

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [dailyBudget, setDailyBudget] = useState(20);

  function handleComplete() {
    updateMutation.mutate({
      displayName: displayName.trim(),
      learningGoal: learningGoal.trim(),
      dailyBudget,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg gradient-brand">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="text-lg font-semibold">LearnGraph</span>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-xl font-medium">What should we call you?</h1>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoFocus
              maxLength={50}
              className="w-full rounded-xl border border-border/30 bg-transparent px-4 py-3 text-[14px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
            />
            <button
              onClick={() => setStep(1)}
              disabled={!displayName.trim()}
              className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-20 transition-opacity"
            >
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-xl font-medium">What do you want to learn?</h1>
            <p className="text-[13px] text-muted-foreground/60">
              This helps us tailor your experience. You can change it later.
            </p>
            <textarea
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              placeholder="e.g., Machine learning fundamentals, organic chemistry, Spanish..."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-border/30 bg-transparent px-4 py-3 text-[14px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
            />
            <button
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Continue
            </button>
            <button
              onClick={() => setStep(0)}
              className="w-full text-[12px] text-muted-foreground/50 hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-xl font-medium">Daily review budget</h1>
            <p className="text-[13px] text-muted-foreground/60">
              How many flashcards do you want to review each day?
            </p>
            <div className="space-y-3">
              <input
                type="range"
                min={5}
                max={50}
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
                className="w-full accent-foreground"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground/50">
                <span>5 cards</span>
                <span className="text-[14px] font-bold text-foreground">{dailyBudget} cards</span>
                <span>50 cards</span>
              </div>
              <p className="text-[11px] text-muted-foreground/40 text-center">
                ~{Math.round(dailyBudget * 0.5)} minutes per day
              </p>
            </div>
            <button
              onClick={handleComplete}
              disabled={updateMutation.isPending}
              className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-50 transition-opacity"
            >
              {updateMutation.isPending ? "Setting up..." : "Get Started"}
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full text-[12px] text-muted-foreground/50 hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="mt-8 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i <= step ? "bg-foreground" : "bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
