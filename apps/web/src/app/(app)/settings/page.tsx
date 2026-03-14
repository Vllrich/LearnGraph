"use client";

import React, { useState } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Bell,
  Clock,
  Shield,
  Save,
  Check,
  GraduationCap,
  MessageSquare,
  Globe,
  Sparkles,
  Accessibility,
  Brain,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@repo/shared";
import type {
  EducationStage,
  CommunicationStyle,
  ExplanationDepth,
  MentorTone,
  LearningMotivation,
  AccessibilityNeeds,
} from "@repo/shared";

const EDUCATION_STAGE_OPTIONS: { id: EducationStage; label: string; icon: string }[] = [
  { id: "elementary", label: "Young Learner (5-12)", icon: "🧒" },
  { id: "high_school", label: "High School (13-18)", icon: "🎒" },
  { id: "university", label: "University (18-25)", icon: "🎓" },
  { id: "professional", label: "Professional", icon: "💼" },
  { id: "self_learner", label: "Self-Learner", icon: "🌱" },
];

const COMMUNICATION_STYLE_OPTIONS: { id: CommunicationStyle; label: string; desc: string }[] = [
  { id: "casual", label: "Casual", desc: "Friendly, conversational, light humor" },
  { id: "balanced", label: "Balanced", desc: "Clear and professional but warm" },
  { id: "formal", label: "Formal", desc: "Academic, structured, precise" },
];

const EXPLANATION_DEPTH_OPTIONS: { id: ExplanationDepth; label: string; desc: string }[] = [
  { id: "concise", label: "Concise", desc: "Bullet points, just the essentials" },
  { id: "standard", label: "Standard", desc: "Clear explanations with examples" },
  { id: "thorough", label: "Thorough", desc: "Deep dives with derivations and edge cases" },
];

const MENTOR_TONE_OPTIONS: { id: MentorTone; label: string; desc: string }[] = [
  { id: "encouraging", label: "Encouraging", desc: "Celebrates progress, patient with mistakes" },
  { id: "neutral", label: "Neutral", desc: "Matter-of-fact, focus on correctness" },
  { id: "challenging", label: "Challenging", desc: "Pushes you harder, asks follow-ups" },
];

const MOTIVATION_OPTIONS: { id: LearningMotivation; label: string; icon: string }[] = [
  { id: "career", label: "Career Growth", icon: "💼" },
  { id: "curiosity", label: "Pure Curiosity", icon: "🔍" },
  { id: "exam", label: "Exam Prep", icon: "📝" },
  { id: "hobby", label: "Hobby / Fun", icon: "🎨" },
  { id: "academic", label: "Academic Research", icon: "🔬" },
];

const COMMON_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Indonesian" },
];

type SettingsTab = "profile" | "mentor" | "study" | "notifications";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <GraduationCap className="size-4" /> },
  { id: "mentor", label: "Mentor", icon: <MessageSquare className="size-4" /> },
  { id: "study", label: "Study", icon: <Clock className="size-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const { data: userProfile, isLoading: isLoadingUser } = trpc.user.getProfile.useQuery();
  const { data: learnerProfile, isLoading: isLoadingProfile } =
    trpc.user.getLearnerProfile.useQuery();
  const { data: streak } = trpc.gamification.getStreakAndXp.useQuery();

  const updatePrefs = trpc.user.updatePreferences.useMutation();
  const updateGoal = trpc.gamification.updateWeeklyGoal.useMutation();
  const updateProfile = trpc.user.updateLearnerProfile.useMutation();
  const utils = trpc.useUtils();

  const prefs = userProfile?.preferences as Record<string, unknown> | undefined;
  const notifs = (prefs?.notifications ??
    DEFAULT_NOTIFICATION_PREFERENCES) as typeof DEFAULT_NOTIFICATION_PREFERENCES;

  // Study preferences
  const resolvedWeeklyGoal = streak?.weeklyReviewGoal ?? 50;
  const resolvedDailyBudget = (prefs?.dailyReviewBudget as number) ?? 20;
  const [weeklyGoal, setWeeklyGoal] = useState(resolvedWeeklyGoal);
  const [dailyBudget, setDailyBudget] = useState(resolvedDailyBudget);

  // Notification state
  const [emailReminders, setEmailReminders] = useState<boolean | null>(null);
  const [pushNotifications, setPushNotifications] = useState<boolean | null>(null);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<"daily" | "every_other_day" | "weekly" | null>(null);
  const [smartNudges, setSmartNudges] = useState<boolean | null>(null);
  const [quietStart, setQuietStart] = useState<string | null>(null);
  const [quietEnd, setQuietEnd] = useState<string | null>(null);

  // Learner profile state (null = unchanged from server)
  const [educationStage, setEducationStage] = useState<EducationStage | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState<string | null>(null);
  const [contentLanguage, setContentLanguage] = useState<string | null>(null);
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle | null>(null);
  const [explanationDepth, setExplanationDepth] = useState<ExplanationDepth | null>(null);
  const [mentorTone, setMentorTone] = useState<MentorTone | null>(null);
  const [expertiseDomains, setExpertiseDomains] = useState<string[] | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [learningMotivations, setLearningMotivations] = useState<LearningMotivation[] | null>(null);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState<AccessibilityNeeds | null>(null);

  const [saved, setSaved] = useState(false);

  // Resolved values (local override ?? server ?? defaults)
  const eff = {
    educationStage: educationStage ?? learnerProfile?.educationStage ?? "self_learner",
    nativeLanguage: nativeLanguage ?? learnerProfile?.nativeLanguage ?? "en",
    contentLanguage: contentLanguage ?? learnerProfile?.contentLanguage ?? "en",
    communicationStyle: communicationStyle ?? learnerProfile?.communicationStyle ?? "balanced",
    explanationDepth: explanationDepth ?? learnerProfile?.explanationDepth ?? "standard",
    mentorTone: mentorTone ?? learnerProfile?.mentorTone ?? "encouraging",
    expertiseDomains: expertiseDomains ?? learnerProfile?.expertiseDomains ?? [],
    learningMotivations: learningMotivations ?? learnerProfile?.learningMotivations ?? [],
    accessibilityNeeds: accessibilityNeeds ?? learnerProfile?.accessibilityNeeds ?? {},
  };

  const notifsFromPrefs = prefs ? ((prefs.notifications ?? {}) as Record<string, unknown>) : {};
  const effNotifs = {
    email: emailReminders ?? (notifsFromPrefs.emailReminders as boolean) ?? notifs.emailReminders,
    push:
      pushNotifications ??
      (notifsFromPrefs.pushNotifications as boolean) ??
      notifs.pushNotifications,
    reminderTime: reminderTime ?? (notifsFromPrefs.reminderTime as string) ?? notifs.reminderTime,
    frequency:
      frequency ?? (notifsFromPrefs.frequency as typeof frequency) ?? notifs.frequency,
    smartNudges:
      smartNudges ?? (notifsFromPrefs.smartNudges as boolean) ?? notifs.smartNudges,
    quietStart:
      quietStart ?? (notifsFromPrefs.quietHoursStart as string) ?? notifs.quietHoursStart,
    quietEnd: quietEnd ?? (notifsFromPrefs.quietHoursEnd as string) ?? notifs.quietHoursEnd,
  };

  function toggleMotivation(m: LearningMotivation) {
    const current = eff.learningMotivations;
    const next = current.includes(m) ? current.filter((x) => x !== m) : [...current, m];
    setLearningMotivations(next);
  }

  function addDomain() {
    const trimmed = domainInput.trim();
    if (!trimmed || eff.expertiseDomains.includes(trimmed)) return;
    setExpertiseDomains([...eff.expertiseDomains, trimmed]);
    setDomainInput("");
  }

  function removeDomain(d: string) {
    setExpertiseDomains(eff.expertiseDomains.filter((x) => x !== d));
  }

  function setA11y(key: keyof AccessibilityNeeds, val: boolean) {
    setAccessibilityNeeds({ ...eff.accessibilityNeeds, [key]: val });
  }

  const isSaving = updatePrefs.isPending || updateGoal.isPending || updateProfile.isPending;

  async function handleSave() {
    await Promise.all([
      updateProfile.mutateAsync({
        educationStage: eff.educationStage,
        nativeLanguage: eff.nativeLanguage,
        contentLanguage: eff.contentLanguage,
        communicationStyle: eff.communicationStyle,
        explanationDepth: eff.explanationDepth,
        mentorTone: eff.mentorTone,
        expertiseDomains: eff.expertiseDomains,
        learningMotivations: eff.learningMotivations,
        accessibilityNeeds: eff.accessibilityNeeds,
      }),
      updatePrefs.mutateAsync({
        dailyReviewBudget: dailyBudget,
        learnerProfile: { educationStage: eff.educationStage },
        notifications: {
          emailReminders: effNotifs.email,
          pushNotifications: effNotifs.push,
          reminderTime: effNotifs.reminderTime,
          frequency: effNotifs.frequency,
          smartNudges: effNotifs.smartNudges,
          quietHoursStart: effNotifs.quietStart,
          quietHoursEnd: effNotifs.quietEnd,
        },
      }),
      updateGoal.mutateAsync({ goal: weeklyGoal }),
    ]);
    utils.user.getProfile.invalidate();
    utils.user.getLearnerProfile.invalidate();
    utils.gamification.getStreakAndXp.invalidate();
    toast.success("Settings saved");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (isLoadingUser || isLoadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link
          href="/"
          className="text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Settings</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar nav ──────────────────────────────── */}
        <nav className="w-48 shrink-0 border-r border-border/30 py-4 px-2 flex flex-col gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all text-left",
                activeTab === tab.id
                  ? "bg-primary/8 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ── Tab content ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-8 py-7 space-y-7">

            {/* ── Profile tab ─────────────────────────────── */}
            {activeTab === "profile" && (
              <>
                <section>
                  <SectionHeader icon={<GraduationCap className="size-4 text-violet-500" />} title="Education Stage" />
                  <div className="space-y-2 rounded-xl border border-border/30 p-4">
                    <p className="text-[11px] text-muted-foreground/50 mb-3">
                      Shapes vocabulary level, analogy sources, and session defaults.
                    </p>
                    {EDUCATION_STAGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setEducationStage(opt.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                          eff.educationStage === opt.id
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/20 hover:border-border/50"
                        )}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="text-[13px] font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader icon={<Globe className="size-4 text-blue-500" />} title="Language" />
                  <div className="space-y-4 rounded-xl border border-border/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium">Native language</p>
                        <p className="text-[11px] text-muted-foreground/50">Your primary spoken language</p>
                      </div>
                      <select
                        value={eff.nativeLanguage}
                        onChange={(e) => setNativeLanguage(e.target.value)}
                        className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                      >
                        {COMMON_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium">Learning language</p>
                        <p className="text-[11px] text-muted-foreground/50">Language the mentor teaches in</p>
                      </div>
                      <select
                        value={eff.contentLanguage}
                        onChange={(e) => setContentLanguage(e.target.value)}
                        className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                      >
                        {COMMON_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHeader icon={<Sparkles className="size-4 text-amber-500" />} title="Learning Motivations" />
                  <div className="rounded-xl border border-border/30 p-4">
                    <p className="text-[11px] text-muted-foreground/50 mb-3">
                      Select all that apply — influences how concepts are framed and which examples are used.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MOTIVATION_OPTIONS.map((opt) => {
                        const active = eff.learningMotivations.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleMotivation(opt.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
                              active
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border/30 text-muted-foreground hover:border-border/50"
                            )}
                          >
                            <span>{opt.icon}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHeader icon={<Brain className="size-4 text-purple-500" />} title="Expertise Domains" />
                  <div className="rounded-xl border border-border/30 p-4">
                    <p className="text-[11px] text-muted-foreground/50 mb-3">
                      Subjects you already know well — the mentor draws analogies from these and skips overlapping prerequisites.
                    </p>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="e.g. Physics, Web Development, Music Theory..."
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())}
                        className="flex-1 rounded-lg border border-border/30 bg-transparent px-3 py-1.5 text-[13px] placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none"
                      />
                      <button
                        onClick={addDomain}
                        disabled={!domainInput.trim()}
                        className="rounded-lg border border-border/30 px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-30 transition-all"
                      >
                        Add
                      </button>
                    </div>
                    {eff.expertiseDomains.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {eff.expertiseDomains.map((d) => (
                          <span
                            key={d}
                            className="flex items-center gap-1 rounded-full border border-border/30 bg-muted/30 px-2.5 py-1 text-[12px]"
                          >
                            {d}
                            <button
                              onClick={() => removeDomain(d)}
                              className="text-muted-foreground/50 hover:text-foreground transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* ── Mentor tab ──────────────────────────────── */}
            {activeTab === "mentor" && (
              <>
                <section>
                  <SectionHeader icon={<MessageSquare className="size-4 text-emerald-500" />} title="Mentor Style" />
                  <div className="space-y-5 rounded-xl border border-border/30 p-4">
                    <OptionGrid
                      label="Communication"
                      description="How the mentor phrases things"
                      options={COMMUNICATION_STYLE_OPTIONS}
                      value={eff.communicationStyle}
                      onChange={(v) => setCommunicationStyle(v as CommunicationStyle)}
                    />
                    <OptionGrid
                      label="Explanation depth"
                      description="How much detail per concept"
                      options={EXPLANATION_DEPTH_OPTIONS}
                      value={eff.explanationDepth}
                      onChange={(v) => setExplanationDepth(v as ExplanationDepth)}
                    />
                    <OptionGrid
                      label="Tone"
                      description="How the mentor motivates you"
                      options={MENTOR_TONE_OPTIONS}
                      value={eff.mentorTone}
                      onChange={(v) => setMentorTone(v as MentorTone)}
                    />
                  </div>
                </section>

                <section>
                  <SectionHeader icon={<Accessibility className="size-4 text-teal-500" />} title="Accessibility" />
                  <div className="space-y-4 rounded-xl border border-border/30 p-4">
                    <p className="text-[11px] text-muted-foreground/50">
                      The mentor adapts its output format to your needs.
                    </p>
                    <ToggleRow
                      label="Dyslexia-friendly"
                      description="Shorter paragraphs, bullet lists, bolded key terms"
                      checked={!!eff.accessibilityNeeds.dyslexia}
                      onChange={(v) => setA11y("dyslexia", v)}
                    />
                    <ToggleRow
                      label="ADHD-friendly"
                      description="Frequent micro-checkpoints, shorter explanations, more quizzes"
                      checked={!!eff.accessibilityNeeds.adhd}
                      onChange={(v) => setA11y("adhd", v)}
                    />
                    <ToggleRow
                      label="Visual impairment"
                      description="Detailed text descriptions of diagrams and visual concepts"
                      checked={!!eff.accessibilityNeeds.visualImpairment}
                      onChange={(v) => setA11y("visualImpairment", v)}
                    />
                    <ToggleRow
                      label="Reduced motion"
                      description="Fewer animations and transitions in the UI"
                      checked={!!eff.accessibilityNeeds.reducedMotion}
                      onChange={(v) => setA11y("reducedMotion", v)}
                    />
                  </div>
                </section>

                {learnerProfile && learnerProfile.calibrationConfidence > 0 && (
                  <section>
                    <SectionHeader icon={<Sparkles className="size-4 text-primary" />} title="AI-Inferred Profile" />
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
                      <p className="text-[11px] text-muted-foreground/50 mb-3">
                        Calibrated from your review sessions — blends with your declared settings above.
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-[12px]">
                        {learnerProfile.inferredPace && (
                          <div>
                            <span className="text-muted-foreground/60">Pace:</span>{" "}
                            <span className="font-medium capitalize">{learnerProfile.inferredPace}</span>
                          </div>
                        )}
                        {learnerProfile.inferredBloomCeiling && (
                          <div>
                            <span className="text-muted-foreground/60">Bloom ceiling:</span>{" "}
                            <span className="font-medium capitalize">{learnerProfile.inferredBloomCeiling}</span>
                          </div>
                        )}
                        {learnerProfile.inferredOptimalSessionMin && (
                          <div>
                            <span className="text-muted-foreground/60">Optimal session:</span>{" "}
                            <span className="font-medium">{learnerProfile.inferredOptimalSessionMin} min</span>
                          </div>
                        )}
                        {learnerProfile.inferredReadingLevel && (
                          <div>
                            <span className="text-muted-foreground/60">Reading level:</span>{" "}
                            <span className="font-medium">Grade {Math.round(learnerProfile.inferredReadingLevel)}</span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-muted-foreground/60">Calibration confidence:</span>{" "}
                          <span className="font-medium">{Math.round(learnerProfile.calibrationConfidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ── Study tab ───────────────────────────────── */}
            {activeTab === "study" && (
              <section>
                <SectionHeader icon={<Clock className="size-4 text-primary" />} title="Study Preferences" />
                <div className="space-y-4 rounded-xl border border-border/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium">Daily review budget</p>
                      <p className="text-[11px] text-muted-foreground/50">Max cards per daily session</p>
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(Number(e.target.value))}
                      className="w-16 rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-center text-[13px] focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium">Weekly review goal</p>
                      <p className="text-[11px] text-muted-foreground/50">Target reviews per week</p>
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={weeklyGoal}
                      onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                      className="w-16 rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-center text-[13px] focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ── Notifications tab ───────────────────────── */}
            {activeTab === "notifications" && (
              <>
                <section>
                  <SectionHeader icon={<Bell className="size-4 text-amber-500" />} title="Notifications & Reminders" />
                  <div className="space-y-4 rounded-xl border border-border/30 p-4">
                    <ToggleRow
                      label="Email reminders"
                      description="Daily digest of due reviews"
                      checked={effNotifs.email}
                      onChange={setEmailReminders}
                    />
                    <ToggleRow
                      label="Push notifications"
                      description="Browser push at study time"
                      checked={effNotifs.push}
                      onChange={setPushNotifications}
                    />
                    <ToggleRow
                      label="Smart nudges"
                      description="Alert when concepts are fading"
                      checked={effNotifs.smartNudges}
                      onChange={setSmartNudges}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium">Reminder time</p>
                        <p className="text-[11px] text-muted-foreground/50">When to send daily reminders</p>
                      </div>
                      <input
                        type="time"
                        value={effNotifs.reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium">Frequency</p>
                      </div>
                      <select
                        value={effNotifs.frequency ?? "daily"}
                        onChange={(e) =>
                          setFrequency(e.target.value as "daily" | "every_other_day" | "weekly")
                        }
                        className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                      >
                        <option value="daily">Daily</option>
                        <option value="every_other_day">Every other day</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHeader icon={<Shield className="size-4 text-violet-500" />} title="Quiet Hours" />
                  <div className="rounded-xl border border-border/30 p-4">
                    <p className="text-[11px] text-muted-foreground/50 mb-3">
                      No notifications during these hours
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={effNotifs.quietStart}
                        onChange={(e) => setQuietStart(e.target.value)}
                        className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                      />
                      <span className="text-[12px] text-muted-foreground/40">to</span>
                      <input
                        type="time"
                        value={effNotifs.quietEnd}
                        onChange={(e) => setQuietEnd(e.target.value)}
                        className="rounded-lg border border-border/30 bg-transparent px-2 py-1.5 text-[13px] focus:border-primary/40 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── Save ────────────────────────────────────── */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-[13px] font-medium text-background disabled:opacity-50 transition-opacity"
            >
              {saved ? (
                <>
                  <Check className="size-4" />
                  Saved
                </>
              ) : isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Save className="size-4" />
                  Save settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="text-[13px] font-medium mb-4 flex items-center gap-2">
      {icon}
      {title}
    </h2>
  );
}

// ── Reusable components ─────────────────────────────────────────────

function OptionGrid<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: { id: T; label: string; desc: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground/50 mb-2">{description}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-all",
              value === opt.id
                ? "border-primary/50 bg-primary/5"
                : "border-border/20 hover:border-border/50"
            )}
          >
            <p className="text-[12px] font-medium">{opt.label}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground/50">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted/60"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform shadow-sm",
            checked && "translate-x-4"
          )}
        />
      </button>
    </div>
  );
}
