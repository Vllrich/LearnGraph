export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const MASTERY_LABELS = {
  0: "Unknown",
  1: "Exposed",
  2: "Practicing",
  3: "Familiar",
  4: "Proficient",
  5: "Mastered",
} as const satisfies Record<MasteryLevel, string>;

export type SourceType =
  | "pdf"
  | "youtube"
  | "audio"
  | "pptx"
  | "docx"
  | "url"
  | "image"
  | "code"
  | "text"
  | "ai_generated";

export type GoalType = "exam_prep" | "skill_building" | "course_supplement" | "exploration";

export type LearnerLevel = "beginner" | "some_knowledge" | "experienced";

export type EducationStage =
  | "elementary"
  | "high_school"
  | "university"
  | "professional"
  | "self_learner";

export type CommunicationStyle = "casual" | "balanced" | "formal";

export type ExplanationDepth = "concise" | "standard" | "thorough";

export type MentorTone = "encouraging" | "neutral" | "challenging";

export type InferredPace = "slow" | "medium" | "fast";

export type LearningMotivation = "career" | "curiosity" | "exam" | "hobby" | "academic";

export type AccessibilityNeeds = {
  dyslexia?: boolean;
  adhd?: boolean;
  visualImpairment?: boolean;
  reducedMotion?: boolean;
};

export type LearnerProfile = {
  educationStage: EducationStage;
  nativeLanguage: string;
  contentLanguage: string;
  communicationStyle: CommunicationStyle;
  explanationDepth: ExplanationDepth;
  mentorTone: MentorTone;
  expertiseDomains: string[];
  learningMotivations: LearningMotivation[];
  accessibilityNeeds: AccessibilityNeeds;

  // Inferred by calibration — null until enough data
  inferredReadingLevel: number | null;
  inferredOptimalSessionMin: number | null;
  inferredBloomCeiling: BloomLevel | null;
  inferredPace: InferredPace | null;
  calibrationConfidence: number;
};

/** Subset of LearnerProfile fields the user can edit directly */
export type LearnerProfileUpdate = Partial<
  Pick<
    LearnerProfile,
    | "educationStage"
    | "nativeLanguage"
    | "contentLanguage"
    | "communicationStyle"
    | "explanationDepth"
    | "mentorTone"
    | "expertiseDomains"
    | "learningMotivations"
    | "accessibilityNeeds"
  >
>;

// ---------------------------------------------------------------------------
// V2 Course System — Learning Modes & Method Weights
// ---------------------------------------------------------------------------

export type LearningMode =
  | "understand_first"
  | "remember_longer"
  | "apply_faster"
  | "deep_mastery"
  | "exam_prep"
  | "mentor_heavy";

export const LEARNING_MODES = [
  "understand_first",
  "remember_longer",
  "apply_faster",
  "deep_mastery",
  "exam_prep",
  "mentor_heavy",
] as const satisfies readonly LearningMode[];

export type MethodWeights = {
  retrievalPractice: number;
  spacedReview: number;
  interleaving: number;
  elaboration: number;
  dualCoding: number;
  concreteExamples: number;
  guidedReflection: number;
  scaffolding: number;
};

export type BlockType =
  | "concept"
  | "worked_example"
  | "checkpoint"
  | "practice"
  | "reflection"
  | "scenario"
  | "mentor";

export const BLOCK_TYPES = [
  "concept",
  "worked_example",
  "checkpoint",
  "practice",
  "reflection",
  "scenario",
  "mentor",
] as const satisfies readonly BlockType[];

export type ModuleType = "mandatory" | "remedial" | "advanced" | "enrichment";

export type ModuleStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed"
  | "skipped";

export type LessonType =
  | "standard"
  | "workshop"
  | "lab"
  | "case_study"
  | "revision"
  | "capstone";

export type LessonStatus = "pending" | "in_progress" | "completed" | "skipped";

export type BlockStatus = "pending" | "in_progress" | "completed" | "skipped";

export type CourseSchemaVersion = 1 | 2;

export type LearningObjectStatus = "processing" | "ready" | "failed";

export type FSRSState = "new" | "learning" | "review" | "relearning";

export type FSRSRating = 1 | 2 | 3 | 4;

export const FSRS_RATING_LABELS = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
} as const satisfies Record<FSRSRating, string>;

export type QuestionType = "mcq" | "short_answer" | "explain_back" | "fill_blank";

export type EdgeType = "prerequisite" | "part_of" | "related_to" | "applied_in" | "contrasts_with";

export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export type SubscriptionTier = "free" | "pro" | "team";

export type AchievementKey =
  | "first_upload"
  | "first_review"
  | "streak_7"
  | "streak_30"
  | "streak_100"
  | "concepts_10"
  | "concepts_50"
  | "concepts_100"
  | "mastered_10"
  | "mastered_50"
  | "explain_back_first"
  | "explain_back_10"
  | "perfect_session"
  | "quick_5_first"
  | "weekly_goal_met"
  | "first_module_complete"
  | "first_course_complete"
  | "modules_5"
  | "modules_10"
  | "blocks_50"
  | "blocks_100";

export type AchievementDef = {
  key: AchievementKey;
  title: string;
  description: string;
  icon: string;
  xp: number;
};

export type NotificationPreferences = {
  emailReminders: boolean;
  pushNotifications: boolean;
  reminderTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  frequency: "daily" | "every_other_day" | "weekly";
  smartNudges: boolean;
};

export type GraphViewMode = "mastery" | "retrievability" | "domain";

export type GraphLayoutMode = "force" | "hierarchical" | "clusters" | "cardtree";

export type QueueMode = "standard" | "quick_5" | "interleaved";
