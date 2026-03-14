export const CHUNK_MAX_TOKENS = 512;
export const CHUNK_OVERLAP_TOKENS = 100;
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const ANTHROPIC_PRIMARY = "claude-sonnet-4-5-20250514";
export const OPENAI_PRIMARY = "gpt-5-mini";
export const OPENAI_FALLBACK = "gpt-5";
export const DEFAULT_DAILY_REVIEW_LIMIT = 20;
export const DEFAULT_REVIEW_MIX_RATIO = { review: 0.8, new: 0.2 };
export const RETRIEVABILITY_THRESHOLD = 0.9;
export const RAG_TOP_K = 5;
export const RAG_VECTOR_WEIGHT = 0.7;
export const RAG_BM25_WEIGHT = 0.3;
export const CONCEPT_SIMILARITY_THRESHOLD = 0.92;
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
  "audio/webm",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const FILE_SOURCE_TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/x-m4a": "audio",
  "audio/webm": "audio",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF Document",
  youtube: "YouTube Video",
  pptx: "PowerPoint",
  docx: "Word Document",
  audio: "Audio",
  url: "Web Article",
  image: "Image",
};

export const QUICK_5_LIMIT = 5;

export const XP_VALUES = {
  review: 10,
  upload: 25,
  explain_back_success: 50,
  explain_back_attempt: 15,
  perfect_session: 30,
  streak_day: 5,
} as const;

export const ACHIEVEMENT_DEFINITIONS: import("./types").AchievementDef[] = [
  {
    key: "first_upload",
    title: "First Upload",
    description: "Upload your first learning material",
    icon: "📤",
    xp: 50,
  },
  {
    key: "first_review",
    title: "First Review",
    description: "Complete your first review session",
    icon: "⚡",
    xp: 25,
  },
  {
    key: "streak_7",
    title: "Week Warrior",
    description: "Maintain a 7-day study streak",
    icon: "🔥",
    xp: 100,
  },
  {
    key: "streak_30",
    title: "Monthly Master",
    description: "Maintain a 30-day study streak",
    icon: "💪",
    xp: 500,
  },
  {
    key: "streak_100",
    title: "Century Scholar",
    description: "Maintain a 100-day study streak",
    icon: "🏆",
    xp: 2000,
  },
  {
    key: "concepts_10",
    title: "Knowledge Seeker",
    description: "Study 10 concepts",
    icon: "🧠",
    xp: 50,
  },
  {
    key: "concepts_50",
    title: "Concept Collector",
    description: "Study 50 concepts",
    icon: "📚",
    xp: 200,
  },
  {
    key: "concepts_100",
    title: "Knowledge Graph Builder",
    description: "Study 100 concepts",
    icon: "🌐",
    xp: 500,
  },
  {
    key: "mastered_10",
    title: "Mastery Beginner",
    description: "Master 10 concepts (level 5)",
    icon: "⭐",
    xp: 150,
  },
  {
    key: "mastered_50",
    title: "Mastery Expert",
    description: "Master 50 concepts (level 5)",
    icon: "🌟",
    xp: 750,
  },
  {
    key: "explain_back_first",
    title: "Teacher's Pet",
    description: "Complete your first explain-back",
    icon: "🎓",
    xp: 75,
  },
  {
    key: "explain_back_10",
    title: "Professor Mode",
    description: "Complete 10 explain-backs",
    icon: "👨‍🏫",
    xp: 300,
  },
  {
    key: "perfect_session",
    title: "Flawless",
    description: "Get 100% accuracy in a review session",
    icon: "💯",
    xp: 100,
  },
  {
    key: "quick_5_first",
    title: "Speed Learner",
    description: "Complete your first Quick 5 session",
    icon: "⏱️",
    xp: 25,
  },
  {
    key: "weekly_goal_met",
    title: "Goal Crusher",
    description: "Meet your weekly review goal",
    icon: "🎯",
    xp: 100,
  },
];

export const DEFAULT_NOTIFICATION_PREFERENCES: import("./types").NotificationPreferences = {
  emailReminders: true,
  pushNotifications: false,
  reminderTime: "09:00",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  frequency: "daily",
  smartNudges: true,
};

export const SOURCE_TYPE_ACCEPT: Record<string, Record<string, string[]>> = {
  file: {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "audio/mpeg": [".mp3"],
    "audio/mp4": [".m4a"],
    "audio/wav": [".wav"],
    "audio/webm": [".webm"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
  },
};
