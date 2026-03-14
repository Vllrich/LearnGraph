"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TopicPicker } from "@/components/home/topic-picker";
import type { EducationStage } from "@repo/shared";

const EDUCATION_STAGES: {
  id: EducationStage;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "elementary",
    label: "Young Learner",
    icon: "🧒",
    description: "Fun, visual, guided activities with short sessions",
  },
  {
    id: "high_school",
    label: "High School",
    icon: "🎒",
    description: "Structured study, exam-focused, strategy coaching",
  },
  {
    id: "university",
    label: "University",
    icon: "🎓",
    description: "Course-aligned, deeper understanding, active learning",
  },
  {
    id: "professional",
    label: "Professional",
    icon: "💼",
    description: "Skill-building, time-efficient, real-world anchored",
  },
  {
    id: "self_learner",
    label: "Self-Learner",
    icon: "🌱",
    description: "Curiosity-driven, flexible pace, broad exploration",
  },
];

const TOTAL_STEPS = 5;

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
  const [educationStage, setEducationStage] = useState<EducationStage | null>(null);
  const [interestTopics, setInterestTopics] = useState<string[]>([]);
  const [learningGoal, setLearningGoal] = useState("");
  const [dailyBudget, setDailyBudget] = useState(20);

  function handleComplete() {
    if (!educationStage) return;
    updateMutation.mutate({
      displayName: displayName.trim(),
      educationStage,
      interestTopics,
      learningGoal: learningGoal.trim(),
      dailyBudget,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <Image src="/Logo.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
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
            <h1 className="text-xl font-medium">Tell us about yourself</h1>
            <p className="text-[13px] text-muted-foreground/60">
              This shapes how we teach you. You can change it later in settings.
            </p>
            <div className="space-y-2">
              {EDUCATION_STAGES.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setEducationStage(stage.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                    educationStage === stage.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/30 hover:border-border/60"
                  )}
                >
                  <span className="text-lg">{stage.icon}</span>
                  <div>
                    <p className="text-[13px] font-medium">{stage.label}</p>
                    <p className="text-[11px] text-muted-foreground/60">{stage.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!educationStage}
              className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-20 transition-opacity"
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
            <div>
              <h1 className="text-xl font-medium">Pick a few interests</h1>
              <p className="mt-1 text-[13px] text-muted-foreground/60">
                Select topics you want to explore. We&apos;ll use these to personalize your recommendations.
              </p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border/20 p-3">
              <TopicPicker selected={interestTopics} onChange={setInterestTopics} />
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              {interestTopics.length === 0 ? "Skip for now" : `Continue (${interestTopics.length} selected)`}
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full text-[12px] text-muted-foreground/50 hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {step === 3 && (
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
              onClick={() => setStep(4)}
              className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Continue
            </button>
            <button
              onClick={() => setStep(2)}
              className="w-full text-[12px] text-muted-foreground/50 hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {step === 4 && (
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
              onClick={() => setStep(3)}
              className="w-full text-[12px] text-muted-foreground/50 hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i).map((i) => (
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
