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
  | "url"
  | "code"
  | "text";

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

export type EdgeType =
  | "prerequisite"
  | "part_of"
  | "related_to"
  | "applied_in"
  | "contrasts_with";

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type SubscriptionTier = "free" | "pro" | "team";
