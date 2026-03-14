"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  Target,
  FileText,
  Briefcase,
  BookOpen,
  Compass,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type {
  GoalType,
  LearnerLevel,
  EducationStage,
  LearningMode,
} from "@repo/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOAL_OPTIONS: { id: GoalType; label: string; icon: string; Icon: LucideIcon; hint: string }[] = [
  { id: "exam_prep", label: "Exam", icon: "📝", Icon: FileText, hint: "Prepare for a test or certification" },
  { id: "skill_building", label: "Career", icon: "💼", Icon: Briefcase, hint: "Build job-relevant skills" },
  { id: "course_supplement", label: "Course", icon: "📚", Icon: BookOpen, hint: "Supplement a class you're taking" },
  { id: "exploration", label: "Curious", icon: "✨", Icon: Compass, hint: "Explore out of interest" },
];

const LEVEL_OPTIONS: { id: LearnerLevel; label: string; icon: string; Icon: LucideIcon }[] = [
  { id: "beginner", label: "Brand new", icon: "🌱", Icon: Sprout },
  { id: "some_knowledge", label: "Some knowledge", icon: "📖", Icon: BookOpen },
  { id: "experienced", label: "Experienced", icon: "🎓", Icon: GraduationCap },
];

type ModeOption = {
  id: LearningMode;
  label: string;
  description: string;
  bullets: string[];
  simplifiedLabel?: string;
};

const ALL_MODE_OPTIONS: ModeOption[] = [
  {
    id: "understand_first",
    label: "Understand first",
    simplifiedLabel: "Step by step",
    description: "Step-by-step explanations with visuals and examples",
    bullets: ["Visual explanations & diagrams", "Worked examples before practice", "Gradual difficulty ramp"],
  },
  {
    id: "remember_longer",
    label: "Remember longer",
    simplifiedLabel: "Quiz me often",
    description: "Spaced repetition and frequent recall checks",
    bullets: ["Frequent recall checks", "Spaced review scheduling", "Mixed topic practice"],
  },
  {
    id: "apply_faster",
    label: "Apply faster",
    description: "Projects, scenarios, and mixed practice",
    bullets: ["Real-world scenarios", "Hands-on exercises", "Mixed topic interleaving"],
  },
  {
    id: "deep_mastery",
    label: "Deep mastery",
    simplifiedLabel: "Challenge me",
    description: "Hard questions, self-explanation, fewer hints",
    bullets: ["Socratic questioning", "Self-explanation prompts", "Advanced problem solving"],
  },
  {
    id: "exam_prep",
    label: "Exam prep",
    description: "Compressed plan with frequent recall and spaced review",
    bullets: ["Practice question focus", "Spaced review cycles", "Exam-pattern training"],
  },
  {
    id: "mentor_heavy",
    label: "Mentor-heavy",
    description: "More AI check-ins, metacognitive prompts",
    bullets: ["Guided reflection prompts", "AI mentor conversations", "Metacognitive coaching"],
  },
];

const SESSION_OPTIONS = [5, 10, 15, 20, 30] as const;

const GOAL_AUTO_MODE: Record<GoalType, Record<EducationStage, LearningMode>> = {
  exam_prep: {
    elementary: "understand_first",
    high_school: "exam_prep",
    university: "exam_prep",
    professional: "exam_prep",
    self_learner: "exam_prep",
  },
  skill_building: {
    elementary: "understand_first",
    high_school: "apply_faster",
    university: "apply_faster",
    professional: "apply_faster",
    self_learner: "apply_faster",
  },
  course_supplement: {
    elementary: "understand_first",
    high_school: "remember_longer",
    university: "understand_first",
    professional: "understand_first",
    self_learner: "understand_first",
  },
  exploration: {
    elementary: "understand_first",
    high_school: "understand_first",
    university: "understand_first",
    professional: "understand_first",
    self_learner: "understand_first",
  },
};

const SESSION_DEFAULTS: Record<EducationStage, { sessionMinutes: number; daysPerWeek: number }> = {
  elementary: { sessionMinutes: 8, daysPerWeek: 5 },
  high_school: { sessionMinutes: 15, daysPerWeek: 5 },
  university: { sessionMinutes: 20, daysPerWeek: 5 },
  professional: { sessionMinutes: 10, daysPerWeek: 4 },
  self_learner: { sessionMinutes: 15, daysPerWeek: 3 },
};

type SuggestedTopic = {
  title: string;
  description: string;
  estimatedMinutes: number;
  enabled: boolean;
};

type WizardStep = 0 | 1 | 2 | 3 | 4;

type CourseSetupWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
};

// ---------------------------------------------------------------------------
// Helpers: which modes to show per education stage
// ---------------------------------------------------------------------------

function getVisibleModes(stage: EducationStage): ModeOption[] {
  switch (stage) {
    case "elementary":
      return []; // skip step entirely
    case "high_school":
      return ALL_MODE_OPTIONS
        .filter((m) => ["understand_first", "remember_longer", "deep_mastery"].includes(m.id))
        .map((m) => ({ ...m, label: m.simplifiedLabel ?? m.label }));
    default:
      return ALL_MODE_OPTIONS;
  }
}

function shouldSkipModeStep(stage: EducationStage): boolean {
  return stage === "elementary";
}

function shouldShowCustomize(stage: EducationStage): boolean {
  return !["elementary", "high_school"].includes(stage);
}

function isCustomizeDefaultExpanded(stage: EducationStage): boolean {
  return stage === "self_learner";
}

// ---------------------------------------------------------------------------
// Generation stage labels
// ---------------------------------------------------------------------------

const GENERATION_STAGES = [
  "Mapping concepts...",
  "Building modules...",
  "Creating lessons...",
  "Generating content...",
  "Ready!",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ONBOARDING_STAGES: { id: EducationStage; label: string; icon: string }[] = [
  { id: "elementary", label: "Elementary school", icon: "🧒" },
  { id: "high_school", label: "High school", icon: "🎒" },
  { id: "university", label: "University", icon: "🎓" },
  { id: "professional", label: "Professional", icon: "💼" },
  { id: "self_learner", label: "Self-directed learner", icon: "🌟" },
];

export function CourseSetupWizard({ open, onOpenChange, topic }: CourseSetupWizardProps) {
  const router = useRouter();
  const { data: learnerProfileData } = trpc.user.getLearnerProfile.useQuery();
  const updateProfile = trpc.user.updateLearnerProfile.useMutation();

  const hasProfile = !!learnerProfileData;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState<EducationStage | null>(null);

  useEffect(() => {
    if (open && !hasProfile) {
      setShowOnboarding(true);
    }
  }, [open, hasProfile]);

  function completeOnboarding() {
    if (onboardingStage) {
      updateProfile.mutate({ educationStage: onboardingStage });
    }
    setShowOnboarding(false);
  }

  const userStage: EducationStage =
    onboardingStage ??
    (learnerProfileData as { educationStage?: EducationStage } | null)?.educationStage ?? "self_learner";

  // Step 0: Purpose
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [contextNote, setContextNote] = useState("");

  // Step 1: Familiarity
  const [level, setLevel] = useState<LearnerLevel | null>(null);

  // Step 2: Topics
  const [topics, setTopics] = useState<SuggestedTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");

  // Step 3: Learning Mode
  const [learningMode, setLearningMode] = useState<LearningMode>("understand_first");
  const [sessionMinutes, setSessionMinutes] = useState(15);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Step 4: Generating
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<WizardStep>(0);

  // Auto-select default mode when goal type changes
  useEffect(() => {
    if (goalType) {
      const defaultMode = GOAL_AUTO_MODE[goalType][userStage];
      setLearningMode(defaultMode);
      const defaults = SESSION_DEFAULTS[userStage];
      setSessionMinutes(defaults.sessionMinutes);
      setDaysPerWeek(defaults.daysPerWeek);
      setCustomizeOpen(isCustomizeDefaultExpanded(userStage));
    }
  }, [goalType, userStage]);

  // Fetch suggested topics when entering step 2
  const fetchTopics = useCallback(async () => {
    if (!goalType || !level || topics.length > 0) return;
    setTopicsLoading(true);
    try {
      const res = await fetch("/api/learn/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          goalType,
          currentLevel: level,
          educationStage: userStage,
          contextNote: contextNote || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics(
          (data.topics as { title: string; description: string; estimatedMinutes: number }[]).map((t) => ({
            ...t,
            enabled: true,
          })),
        );
      }
    } catch {
      /* silently fail */
    } finally {
      setTopicsLoading(false);
    }
  }, [goalType, level, topic, userStage, contextNote, topics.length]);

  useEffect(() => {
    if (step === 2) void fetchTopics();
  }, [step, fetchTopics]);

  function toggleTopic(index: number) {
    setTopics((prev) =>
      prev.map((t, i) => (i === index ? { ...t, enabled: !t.enabled } : t)),
    );
  }

  function addCustomTopic() {
    if (!newTopicTitle.trim()) return;
    setTopics((prev) => [
      ...prev,
      { title: newTopicTitle.trim(), description: "Custom topic", estimatedMinutes: 10, enabled: true },
    ]);
    setNewTopicTitle("");
  }

  function removeTopic(index: number) {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  }

  const enabledTopics = topics.filter((t) => t.enabled);
  const totalMinutes = enabledTopics.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const estimatedSessions = Math.ceil(totalMinutes / (sessionMinutes || 15));
  const estimatedWeeks = Math.ceil(estimatedSessions / (daysPerWeek || 5));

  const handleGenerate = useCallback(async () => {
    if (!goalType || !level) return;
    setGenerating(true);
    setGenStage(0);
    setError(null);

    const stageInterval = setInterval(() => {
      setGenStage((prev) => Math.min(prev + 1, GENERATION_STAGES.length - 2));
    }, 8000);

    const selectedTopics = enabledTopics.length > 0
      ? enabledTopics.map((t) => ({ title: t.title, description: t.description }))
      : undefined;

    try {
      const res = await fetch("/api/learn/start-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          goalType,
          currentLevel: level,
          learningMode,
          educationStage: userStage,
          selectedTopics,
          sessionMinutes,
          daysPerWeek,
          examDate: examDate || undefined,
          examName: examName || undefined,
          contextNote: contextNote || undefined,
        }),
      });

      clearInterval(stageInterval);

      if (res.ok) {
        const data = await res.json();
        setGenStage(GENERATION_STAGES.length - 1);
        setTimeout(() => {
          router.push(`/course/${data.goalId}`);
        }, 800);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? "Something went wrong. Please try again.");
        setGenerating(false);
      }
    } catch {
      clearInterval(stageInterval);
      setError("Network error. Please check your connection.");
      setGenerating(false);
    }
  }, [
    topic, goalType, level, learningMode, userStage,
    enabledTopics, sessionMinutes, daysPerWeek,
    examDate, examName, contextNote, router,
  ]);

  const skipModeStep = shouldSkipModeStep(userStage);
  const visibleModes = getVisibleModes(userStage);

  function canGoNext(): boolean {
    if (step === 0) return !!goalType;
    if (step === 1) return !!level;
    if (step === 2) return true;
    if (step === 3) return true;
    return false;
  }

  function goNext() {
    let next = step + 1;
    if (skipModeStep && next === 3) next = 4; // skip mode step
    if (next <= 4) setStep(next as WizardStep);
  }

  function goBack() {
    let prev = step - 1;
    if (skipModeStep && prev === 3) prev = 2; // skip mode step back
    if (prev >= 0) setStep(prev as WizardStep);
  }

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(0);
      setGoalType(null);
      setExamName("");
      setExamDate("");
      setContextNote("");
      setLevel(null);
      setTopics([]);
      setTopicsLoading(false);
      setNewTopicTitle("");
      setLearningMode("understand_first");
      setSessionMinutes(15);
      setDaysPerWeek(5);
      setCustomizeOpen(false);
      setShowOnboarding(false);
      setOnboardingStage(null);
      setGenerating(false);
      setGenStage(0);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  // Is exam auto-resolved (high school + exam_prep)?
  const isExamAutoResolved =
    userStage === "high_school" && goalType === "exam_prep";

  const totalSteps = skipModeStep ? 4 : 5;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-center border-b border-border/20 px-6 py-4">
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i <= step ? "w-8 bg-primary" : "w-4 bg-muted-foreground/15",
              )}
            />
          ))}
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 rounded-lg p-1 text-muted-foreground/50 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        <div className={cn("w-full transition-all", step === 2 && !topicsLoading ? "max-w-3xl" : "max-w-md")}>
          {/* First-time onboarding */}
          {showOnboarding && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground/60 font-(family-name:--font-source-serif)">
                  Quick question before we start
                </p>
                <h2 className="text-xl font-semibold font-(family-name:--font-source-serif)">
                  What best describes you?
                </h2>
              </div>
              <div className="space-y-2">
                {ONBOARDING_STAGES.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setOnboardingStage(opt.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                      onboardingStage === opt.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/30 hover:border-border/60",
                    )}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={completeOnboarding}
                disabled={!onboardingStage}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 0: Purpose */}
          {!showOnboarding && step === 0 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground/60 font-(family-name:--font-source-serif)">
                  Great topic. What brings you to
                </p>
                <h2 className="text-xl font-semibold font-(family-name:--font-source-serif)">
                  {topic}?
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setGoalType(opt.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all",
                      goalType === opt.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/30 hover:border-border/60",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{opt.icon}</span> {opt.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50">{opt.hint}</span>
                  </button>
                ))}
              </div>

              {goalType === "exam_prep" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="Exam name (e.g., AP Biology, AWS SAA-C03)"
                    className="w-full rounded-lg border border-border/30 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground/40" />
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full rounded-lg border border-border/30 bg-transparent px-3 py-2 text-sm text-muted-foreground focus:border-foreground/20 focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {goalType === "skill_building" && (
                <input
                  type="text"
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="Target role or skill (e.g., Backend Engineer, Data Analysis)"
                  className="w-full rounded-lg border border-border/30 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
                />
              )}
              {goalType === "course_supplement" && (
                <input
                  type="text"
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="Course name (e.g., CS 101, Organic Chemistry II)"
                  className="w-full rounded-lg border border-border/30 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
                />
              )}
            </div>
          )}

          {/* Step 1: Familiarity */}
          {!showOnboarding && step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground/60 font-(family-name:--font-source-serif)">
                  How familiar are you with
                </p>
                <h2 className="text-xl font-semibold font-(family-name:--font-source-serif)">
                  {topic}?
                </h2>
              </div>

              <div className="space-y-2">
                {LEVEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setLevel(opt.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                      level === opt.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/30 hover:border-border/60",
                    )}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Topic Scope */}
          {!showOnboarding && step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground/60 font-(family-name:--font-source-serif)">
                  Here&apos;s what I&apos;d suggest covering.
                </p>
                <h2 className="text-lg font-semibold font-(family-name:--font-source-serif)">
                  Toggle topics on or off
                </h2>
              </div>

              {topicsLoading ? (
                <div className="flex flex-col items-center gap-4 py-16">
                  <div className="relative size-10">
                    <div className="absolute inset-0 animate-[spin_2s_linear_infinite] rounded-full border-2 border-transparent border-t-primary/60" />
                    <div className="absolute inset-1 animate-[spin_3s_linear_infinite_reverse] rounded-full border-2 border-transparent border-t-primary/30" />
                  </div>
                  <AnimatedLoadingText />
                </div>
              ) : (
                <>
                  {/* Topics in 3 horizontal difficulty columns */}
                  {(() => {
                    const groupSize = Math.max(2, Math.ceil(topics.length / 3));
                    const groups = [
                      { label: "Foundations", Icon: Layers, topics: topics.slice(0, groupSize) },
                      { label: "Core Concepts", Icon: Zap, topics: topics.slice(groupSize, groupSize * 2) },
                      { label: "Advanced", Icon: Target, topics: topics.slice(groupSize * 2) },
                    ].filter((g) => g.topics.length > 0);

                    return (
                      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}>
                        {groups.map((group, gi) => (
                          <div key={gi} className="flex flex-col gap-1.5">
                            <div className="mb-1 flex items-center gap-1.5 px-1">
                              <group.Icon className="size-3 text-muted-foreground/40" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                                {group.label}
                              </span>
                            </div>
                            {group.topics.map((t) => {
                              const idx = topics.indexOf(t);
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "group/card relative rounded-lg border px-2.5 py-2 transition-all",
                                    t.enabled
                                      ? "border-border/30 bg-card"
                                      : "border-border/15 bg-muted/20 opacity-40",
                                  )}
                                >
                                  <button
                                    onClick={() => toggleTopic(idx)}
                                    className="flex w-full items-start gap-2 text-left"
                                  >
                                    <div className={cn(
                                      "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border transition-all",
                                      t.enabled
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border/50",
                                    )}>
                                      {t.enabled && <Check className="size-2" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-medium leading-snug">{t.title}</p>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground/40 leading-snug line-clamp-2">
                                        {t.description}
                                      </p>
                                      <span className="mt-1 block text-[10px] text-muted-foreground/30">
                                        {t.estimatedMinutes}m
                                      </span>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => removeTopic(idx)}
                                    className="absolute right-1.5 top-1.5 hidden text-muted-foreground/20 hover:text-destructive group-hover/card:block"
                                  >
                                    <X className="size-2.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomTopic()}
                      placeholder="Add a custom topic..."
                      className="flex-1 rounded-lg border border-border/30 bg-transparent px-3 py-2 text-[13px] placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
                    />
                    <button
                      onClick={addCustomTopic}
                      disabled={!newTopicTitle.trim()}
                      className="flex size-8 items-center justify-center rounded-lg border border-border/30 text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-30"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {/* Estimated structure preview */}
                  <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
                      <span>{enabledTopics.length} topics</span>
                      <span className="text-border/50">·</span>
                      <span>~{Math.max(3, Math.ceil(enabledTopics.length / 2))} modules</span>
                      <span className="text-border/50">·</span>
                      <span>~{Math.max(6, enabledTopics.length * 2)} lessons</span>
                      <span className="text-border/50">·</span>
                      <span>~{Math.max(18, enabledTopics.length * 5)} blocks</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground/40">
                      ~{estimatedWeeks} week{estimatedWeeks !== 1 ? "s" : ""} at {sessionMinutes}min/day, {daysPerWeek} days/week
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Learning Mode (adaptive per education stage) */}
          {!showOnboarding && step === 3 && !skipModeStep && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground/60 font-(family-name:--font-source-serif)">
                  How would you like to learn?
                </p>
                <h2 className="text-lg font-semibold font-(family-name:--font-source-serif)">
                  {isExamAutoResolved
                    ? "Exam preparation focus"
                    : "Choose your learning style"}
                </h2>
              </div>

              {isExamAutoResolved ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
                  <p className="text-sm font-medium">Exam prep mode</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Practice questions and spaced review optimized for your exam.
                  </p>
                </div>
              ) : (
                <div className={cn(
                  "grid gap-2",
                  visibleModes.length <= 3 ? "grid-cols-1" : "grid-cols-2",
                )}>
                  {visibleModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setLearningMode(mode.id)}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3 text-left transition-all",
                        learningMode === mode.id
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/30 hover:border-border/60",
                      )}
                    >
                      <p className="text-[13px] font-medium">{mode.label}</p>
                      <p className="text-[11px] text-muted-foreground/60">{mode.description}</p>
                      <div className="mt-0.5 space-y-0.5">
                        {mode.bullets.map((b, j) => (
                          <p key={j} className="text-[10px] text-muted-foreground/40">
                            {b}
                          </p>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Session length + days/week (always shown) */}
              <div className="space-y-3 pt-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Session length</p>
                  <div className="flex gap-1.5">
                    {SESSION_OPTIONS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setSessionMinutes(m)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                          sessionMinutes === m
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/30 text-muted-foreground hover:border-border/60",
                        )}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Days/week</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDaysPerWeek(d)}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md border text-[11px] font-medium transition-all",
                          daysPerWeek === d
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/30 text-muted-foreground/50 hover:border-border/60",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customize panel (university+) */}
              {shouldShowCustomize(userStage) && (
                <div className="border-t border-border/20 pt-3">
                  <button
                    onClick={() => setCustomizeOpen((o) => !o)}
                    className="flex w-full items-center justify-between text-xs text-muted-foreground/60 hover:text-muted-foreground"
                  >
                    <span>Customize method emphasis</span>
                    {customizeOpen ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                  {customizeOpen && (
                    <p className="mt-2 text-[10px] text-muted-foreground/40">
                      Method weights are computed automatically from your chosen mode and
                      profile. Fine-grained customization will be available in a future update.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Generate */}
          {!showOnboarding && step === 4 && (
            <div className="space-y-5">
              {generating ? (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="relative size-24">
                    <svg viewBox="0 0 96 96" className="absolute inset-0 size-full animate-[spin_8s_linear_infinite]">
                      <circle cx="48" cy="8" r="5" className="fill-primary/80" />
                      <circle cx="88" cy="48" r="4" className="fill-primary/50" />
                      <circle cx="48" cy="88" r="5" className="fill-primary/80" />
                      <circle cx="8" cy="48" r="4" className="fill-primary/50" />
                    </svg>
                    <svg viewBox="0 0 96 96" className="absolute inset-0 size-full animate-[spin_4s_linear_infinite_reverse]">
                      <circle cx="48" cy="48" r="36" fill="none" strokeWidth="1.5"
                        className="stroke-primary/20" strokeDasharray="12 8"
                      />
                    </svg>
                    <svg viewBox="0 0 96 96" className="absolute inset-0 size-full animate-[spin_12s_linear_infinite]">
                      <circle cx="48" cy="48" r="22" fill="none" strokeWidth="1.5"
                        className="stroke-primary/30" strokeDasharray="6 10"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <GraduationCap className="size-8 text-primary" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{GENERATION_STAGES[genStage]}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Creating a personalized course for {topic}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold font-(family-name:--font-source-serif)">
                      Ready to start?
                    </h2>
                    <p className="text-sm text-muted-foreground/60 font-(family-name:--font-source-serif)">
                      Here&apos;s a summary of your learning plan.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3">
                    <SummaryRow label="Topic" value={topic} onEdit={() => onOpenChange(false)} />
                    <SummaryRow
                      label="Goal"
                      value={(() => {
                        const g = GOAL_OPTIONS.find((o) => o.id === goalType);
                        return g ? (
                          <span className="flex items-center gap-1.5">
                            <g.Icon className="size-3.5 text-muted-foreground/50" />
                            {g.label}{examName ? ` — ${examName}` : ""}{contextNote ? ` — ${contextNote}` : ""}
                          </span>
                        ) : null;
                      })()}
                      onEdit={() => setStep(0)}
                    />
                    <SummaryRow
                      label="Level"
                      value={(() => {
                        const l = LEVEL_OPTIONS.find((o) => o.id === level);
                        return l ? (
                          <span className="flex items-center gap-1.5">
                            <l.Icon className="size-3.5 text-muted-foreground/50" />
                            {l.label}
                          </span>
                        ) : null;
                      })()}
                      onEdit={() => setStep(1)}
                    />
                    <SummaryRow
                      label="Topics"
                      value={`${enabledTopics.length} subtopics · ~${totalMinutes} min total`}
                      onEdit={() => setStep(2)}
                    />
                    <SummaryRow
                      label="Mode"
                      value={
                        userStage === "elementary"
                          ? "Best approach for your age"
                          : ALL_MODE_OPTIONS.find((m) => m.id === learningMode)?.label ?? learningMode
                      }
                      onEdit={skipModeStep ? undefined : () => setStep(3)}
                    />
                    <SummaryRow
                      label="Schedule"
                      value={`${sessionMinutes}min sessions · ${daysPerWeek}x/week · ~${estimatedWeeks}w`}
                      onEdit={skipModeStep ? () => setStep(2) : () => setStep(3)}
                    />
                  </div>

                  <div className="rounded-lg border border-border/20 bg-muted/10 px-4 py-3 text-center text-[11px] text-muted-foreground/50">
                    ~{Math.max(2, Math.round(enabledTopics.length / 3))} modules · ~{enabledTopics.length} lessons · ~{enabledTopics.length * 5} blocks
                  </div>

                  <button
                    onClick={handleGenerate}
                    className="w-full rounded-xl bg-foreground py-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Start Learning
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation footer */}
      {step < 4 && (
        <div className="shrink-0 border-t border-border/20 px-6 py-5">
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all",
                canGoNext()
                  ? "bg-foreground text-background hover:opacity-90"
                  : "bg-muted/30 text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              {step === (skipModeStep ? 2 : 3) ? "Review" : "Continue"} <ArrowRight className="size-3.5" />
            </button>
            <button
              onClick={goBack}
              disabled={step === 0}
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground/50 transition-all",
                step === 0 ? "invisible" : "hover:text-foreground",
              )}
            >
              <ArrowLeft className="size-3" /> Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TOPIC_LOADING_MESSAGES = [
  "Analyzing your goal...",
  "Mapping key concepts...",
  "Structuring learning path...",
  "Generating topic outline...",
  "Tailoring to your level...",
];

function AnimatedLoadingText() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TOPIC_LOADING_MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className={cn(
      "text-sm text-muted-foreground/60 transition-opacity duration-300",
      visible ? "opacity-100" : "opacity-0",
    )}>
      {TOPIC_LOADING_MESSAGES[idx]}
    </p>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/20 px-4 py-2.5">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
          {label}
        </p>
        <p className="text-[13px]">{value}</p>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-[11px] text-muted-foreground/50 hover:text-foreground"
        >
          Edit
        </button>
      )}
    </div>
  );
}
