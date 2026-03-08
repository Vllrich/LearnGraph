import type { EducationStage, GoalType, MethodPreferences, FocusMode } from "@repo/shared";

export type MethodDefaults = {
  methods: MethodPreferences;
  sessionMinutes: number;
  daysPerWeek: number;
  focusMode: FocusMode;
};

const BASE_DEFAULTS: Record<EducationStage, MethodDefaults> = {
  elementary: {
    methods: { guidedLessons: 45, practiceTesting: 30, explainBack: 5, spacedReview: 20 },
    sessionMinutes: 8,
    daysPerWeek: 5,
    focusMode: "concept_mastery",
  },
  high_school: {
    methods: { guidedLessons: 30, practiceTesting: 30, explainBack: 15, spacedReview: 25 },
    sessionMinutes: 15,
    daysPerWeek: 5,
    focusMode: "concept_mastery",
  },
  university: {
    methods: { guidedLessons: 20, practiceTesting: 25, explainBack: 25, spacedReview: 30 },
    sessionMinutes: 20,
    daysPerWeek: 5,
    focusMode: "breadth",
  },
  professional: {
    methods: { guidedLessons: 15, practiceTesting: 25, explainBack: 25, spacedReview: 35 },
    sessionMinutes: 10,
    daysPerWeek: 4,
    focusMode: "concept_mastery",
  },
  self_learner: {
    methods: { guidedLessons: 25, practiceTesting: 20, explainBack: 20, spacedReview: 35 },
    sessionMinutes: 15,
    daysPerWeek: 3,
    focusMode: "breadth",
  },
};

const GOAL_OVERRIDES: Record<GoalType, Partial<MethodDefaults> & { methods?: Partial<MethodPreferences> }> = {
  exam_prep: {
    methods: { practiceTesting: 35, spacedReview: 30 },
    focusMode: "exam_readiness",
  },
  skill_building: {
    methods: { explainBack: 30, guidedLessons: 20 },
    focusMode: "concept_mastery",
  },
  course_supplement: {
    methods: { guidedLessons: 30, spacedReview: 25 },
    focusMode: "concept_mastery",
  },
  exploration: {
    methods: { guidedLessons: 35, practiceTesting: 15 },
    focusMode: "breadth",
  },
};

function normalizeWeights(m: MethodPreferences): MethodPreferences {
  const total = m.guidedLessons + m.practiceTesting + m.explainBack + m.spacedReview;
  if (total === 0) return { guidedLessons: 25, practiceTesting: 25, explainBack: 25, spacedReview: 25 };
  const scale = 100 / total;
  return {
    guidedLessons: Math.round(m.guidedLessons * scale),
    practiceTesting: Math.round(m.practiceTesting * scale),
    explainBack: Math.round(m.explainBack * scale),
    spacedReview: Math.round(m.spacedReview * scale),
  };
}

export function getMethodDefaults(educationStage: EducationStage, goalType: GoalType): MethodDefaults {
  const base = { ...BASE_DEFAULTS[educationStage] };
  const override = GOAL_OVERRIDES[goalType];

  const merged: MethodPreferences = {
    guidedLessons: override.methods?.guidedLessons ?? base.methods.guidedLessons,
    practiceTesting: override.methods?.practiceTesting ?? base.methods.practiceTesting,
    explainBack: override.methods?.explainBack ?? base.methods.explainBack,
    spacedReview: override.methods?.spacedReview ?? base.methods.spacedReview,
  };

  return {
    methods: normalizeWeights(merged),
    sessionMinutes: base.sessionMinutes,
    daysPerWeek: base.daysPerWeek,
    focusMode: override.focusMode ?? base.focusMode,
  };
}

export function getEducationStagePrompt(stage: EducationStage): string {
  const prompts: Record<EducationStage, string> = {
    elementary: `The learner is a young child (ages 5-12). Use simple, concrete language. Break concepts into very small steps with visual/hands-on examples. Use play-based analogies and guided exploration. Keep each unit under 8 minutes. Favor concrete manipulatives and visual aids before abstract concepts.`,
    high_school: `The learner is a teenager (ages 13-18). Frame content in terms of relevance to exams and future goals. Use structured explanations followed by practice problems. Teach study strategies explicitly. Allow some autonomy in approach. Include collaborative and discussion-based elements where possible.`,
    university: `The learner is a university student (ages 18-25). Use active, problem-centered learning. Start with brief explanations then move to problem-solving and application. Interleave related topics. Expect capacity for abstract reasoning and self-regulation. Include peer-instruction-style questions.`,
    professional: `The learner is a working professional. Anchor learning in real-world problems and practical application. Be time-efficient — focus on actionable knowledge. Use cycles of introduction, application, feedback, and reflection. Leverage their existing experience as context.`,
    self_learner: `The learner is a self-directed lifelong learner. Follow their curiosity — cover interesting and surprising aspects. Provide structure but allow flexibility. Encourage self-assessment and reflection. Balance breadth with depth based on their interests.`,
  };
  return prompts[stage];
}
