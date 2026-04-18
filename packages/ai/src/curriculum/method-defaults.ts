import type {
  EducationStage,
  GoalType,
  LearnerProfile,
  LearningMode,
  MethodWeights,
} from "@repo/shared";

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

/**
 * Builds a richer curriculum-generation prompt that incorporates the full
 * learner profile, not just the education stage.
 */
export function getProfilePrompt(profile: LearnerProfile): string {
  const parts: string[] = [getEducationStagePrompt(profile.educationStage)];

  if (profile.contentLanguage !== "en") {
    parts.push(
      `Generate all curriculum item titles and descriptions in ${profile.contentLanguage}. ` +
        `Keep technical terms in English with a translation in parentheses.`
    );
  }

  const depthMap: Record<string, string> = {
    concise: "Keep descriptions brief and action-oriented (1-2 sentences each).",
    standard: "Provide clear, moderate-length descriptions (2-3 sentences each).",
    thorough:
      "Provide detailed descriptions with learning objectives, key sub-topics, and expected outcomes.",
  };
  parts.push(depthMap[profile.explanationDepth] ?? depthMap.standard);

  if (profile.expertiseDomains.length > 0) {
    parts.push(
      `The learner already has expertise in: ${profile.expertiseDomains.join(", ")}. ` +
        `Skip or abbreviate prerequisites that overlap with these domains. ` +
        `Use cross-domain analogies from their expertise to introduce new concepts.`
    );
  }

  const motivationHints: Record<string, string> = {
    career: "Prioritize professionally applicable skills and industry-relevant examples.",
    curiosity: "Include surprising connections and 'aha moment' concepts.",
    exam: "Order by exam likelihood. Include review/practice-testing items for high-value topics.",
    hobby: "Keep it fun, project-oriented, and low-pressure.",
    academic: "Include theoretical foundations and connections to the broader field.",
  };
  const motHints = profile.learningMotivations
    .map((m) => motivationHints[m])
    .filter(Boolean);
  if (motHints.length > 0) parts.push(motHints.join(" "));

  if (profile.inferredPace === "slow" && profile.calibrationConfidence > 0.3) {
    parts.push(
      "Break concepts into smaller-than-usual chunks. " +
        "Add explicit review checkpoints between concept groups."
    );
  } else if (profile.inferredPace === "fast" && profile.calibrationConfidence > 0.3) {
    parts.push(
      "This learner progresses quickly — you can combine related basics into single units " +
        "and allocate more time to advanced topics."
    );
  }

  if (profile.accessibilityNeeds.adhd) {
    parts.push(
      "Keep each concept unit short (max 10 minutes). " +
        "Alternate between methods frequently to maintain engagement."
    );
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// V2 — Evidence-based method weights for modular courses
// ---------------------------------------------------------------------------

const MODE_BASE_WEIGHTS: Record<LearningMode, MethodWeights> = {
  understand_first: {
    retrievalPractice: 10,
    spacedReview: 10,
    interleaving: 5,
    elaboration: 10,
    dualCoding: 20,
    concreteExamples: 25,
    guidedReflection: 5,
    scaffolding: 15,
  },
  remember_longer: {
    retrievalPractice: 25,
    spacedReview: 25,
    interleaving: 15,
    elaboration: 5,
    dualCoding: 5,
    concreteExamples: 10,
    guidedReflection: 5,
    scaffolding: 10,
  },
  apply_faster: {
    retrievalPractice: 10,
    spacedReview: 5,
    interleaving: 20,
    elaboration: 10,
    dualCoding: 5,
    concreteExamples: 25,
    guidedReflection: 5,
    scaffolding: 20,
  },
  deep_mastery: {
    retrievalPractice: 20,
    spacedReview: 10,
    interleaving: 20,
    elaboration: 25,
    dualCoding: 5,
    concreteExamples: 10,
    guidedReflection: 5,
    scaffolding: 5,
  },
  exam_prep: {
    retrievalPractice: 25,
    spacedReview: 20,
    interleaving: 15,
    elaboration: 5,
    dualCoding: 5,
    concreteExamples: 15,
    guidedReflection: 5,
    scaffolding: 10,
  },
  mentor_heavy: {
    retrievalPractice: 10,
    spacedReview: 5,
    interleaving: 5,
    elaboration: 25,
    dualCoding: 5,
    concreteExamples: 10,
    guidedReflection: 25,
    scaffolding: 15,
  },
};

const STAGE_ADJUSTMENTS: Record<EducationStage, Partial<MethodWeights>> = {
  elementary: { scaffolding: 20, dualCoding: 15, concreteExamples: 15, elaboration: -15, interleaving: -10 },
  high_school: { scaffolding: 10, concreteExamples: 10, retrievalPractice: 5 },
  university: {},
  professional: { concreteExamples: 10, scaffolding: -10 },
  self_learner: {},
};

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

function normalizeMethodWeights(w: MethodWeights): MethodWeights {
  const keys = Object.keys(w) as (keyof MethodWeights)[];
  const clamped = {} as MethodWeights;
  for (const k of keys) clamped[k] = Math.max(0, w[k]);
  const total = keys.reduce((s, k) => s + clamped[k], 0);
  if (total === 0) {
    const even = 100 / keys.length;
    for (const k of keys) clamped[k] = Math.round(even);
    return clamped;
  }
  const scale = 100 / total;
  for (const k of keys) clamped[k] = Math.round(clamped[k] * scale);
  return clamped;
}

export function getDefaultLearningMode(
  goalType: GoalType,
  stage: EducationStage,
): LearningMode {
  return GOAL_AUTO_MODE[goalType][stage];
}

export function getMethodWeights(
  mode: LearningMode,
  profile?: LearnerProfile | null,
): MethodWeights {
  const base = { ...MODE_BASE_WEIGHTS[mode] };
  const stage = profile?.educationStage ?? "self_learner";
  const adj = STAGE_ADJUSTMENTS[stage];

  const keys = Object.keys(base) as (keyof MethodWeights)[];
  for (const k of keys) {
    base[k] += adj[k] ?? 0;
  }

  if (profile?.accessibilityNeeds?.adhd) {
    base.scaffolding += 10;
    base.retrievalPractice += 5;
  }
  if (profile?.accessibilityNeeds?.dyslexia) {
    base.dualCoding += 10;
    base.scaffolding += 5;
  }

  if (profile?.inferredPace === "slow" && (profile.calibrationConfidence ?? 0) > 0.3) {
    base.scaffolding += 10;
    base.interleaving -= 5;
  } else if (profile?.inferredPace === "fast" && (profile.calibrationConfidence ?? 0) > 0.3) {
    base.interleaving += 10;
    base.scaffolding -= 5;
  }

  return normalizeMethodWeights(base);
}

export function getSessionDefaults(stage: EducationStage): {
  sessionMinutes: number;
  daysPerWeek: number;
} {
  const map: Record<EducationStage, { sessionMinutes: number; daysPerWeek: number }> = {
    elementary: { sessionMinutes: 8, daysPerWeek: 5 },
    high_school: { sessionMinutes: 15, daysPerWeek: 5 },
    university: { sessionMinutes: 20, daysPerWeek: 5 },
    professional: { sessionMinutes: 10, daysPerWeek: 4 },
    self_learner: { sessionMinutes: 15, daysPerWeek: 3 },
  };
  return map[stage];
}
