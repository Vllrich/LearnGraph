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

export const UPLOADABLE_SOURCE_TYPES = [
  "pdf",
  "youtube",
  "pptx",
  "docx",
  "audio",
  "url",
  "image",
] as const;

export type UploadableSourceType = (typeof UPLOADABLE_SOURCE_TYPES)[number];

export type GoalType = "exam_prep" | "skill_building" | "course_supplement" | "exploration";

export type LearnerLevel = "beginner" | "some_knowledge" | "experienced";

export type LearningMethod =
  | "guided_lesson"
  | "practice_testing"
  | "explain_back"
  | "spaced_review"
  | "interleaved_practice"
  | "reflection";

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
  | "weekly_goal_met";

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

export type QueueMode = "standard" | "quick_5" | "interleaved";
