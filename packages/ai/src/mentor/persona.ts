import type { LearnerProfile } from "@repo/shared";

/**
 * Builds a system-prompt paragraph that modulates the mentor's tone,
 * vocabulary, explanation depth, and teaching strategy based on the
 * learner's declared + inferred profile.
 */
export function buildPersonaBlock(profile: LearnerProfile): string {
  const fragments: string[] = [];

  // ── Language ──────────────────────────────────────────────────────
  if (profile.contentLanguage !== "en") {
    fragments.push(
      `The student's native language is ${profile.nativeLanguage}. ` +
        `Teach in ${profile.contentLanguage}. When introducing key technical terms, ` +
        `provide the English equivalent in parentheses so they can search for resources.`
    );
  }

  // ── Reading level (inferred takes priority, else derive from stage) ──
  const readingLevel =
    profile.inferredReadingLevel ?? stageToReadingLevel(profile.educationStage);

  if (readingLevel < 6) {
    fragments.push(
      "Use simple, concrete vocabulary (grade 4-5 reading level). " +
        "Keep sentences short. Prefer everyday analogies and visual descriptions. " +
        "Avoid jargon — if you must use a technical term, define it immediately."
    );
  } else if (readingLevel < 10) {
    fragments.push(
      "Use clear language appropriate for a teenager. " +
        "Introduce technical terms with brief inline definitions. " +
        "Use relatable analogies from school, technology, or pop culture."
    );
  } else if (readingLevel < 14) {
    fragments.push(
      "Use precise language at an undergraduate level. " +
        "Technical terminology is fine — define on first use only. " +
        "Include worked examples alongside abstract explanations."
    );
  } else {
    fragments.push(
      "Use precise academic language. Assume familiarity with standard " +
        "technical terminology. Prioritize rigor and nuance over simplification."
    );
  }

  // ── Communication style ───────────────────────────────────────────
  const styleMap: Record<LearnerProfile["communicationStyle"], string> = {
    casual:
      "Be conversational and warm. Use contractions. Light humor is welcome. " +
      "Address the student as a peer.",
    balanced:
      "Be clear, friendly, and professional. " +
      "Structured but not stiff.",
    formal:
      "Use formal academic tone. No colloquialisms or contractions. " +
      "Structure explanations as: definition → properties → examples → caveats.",
  };
  fragments.push(styleMap[profile.communicationStyle]);

  // ── Explanation depth ─────────────────────────────────────────────
  const depthMap: Record<LearnerProfile["explanationDepth"], string> = {
    concise:
      "Be brief. Bullet points over paragraphs. " +
      "Only elaborate when the student explicitly asks for more detail.",
    standard:
      "Provide clear explanations with one example per concept. " +
      "Balance depth with conciseness.",
    thorough:
      "Give detailed explanations with step-by-step derivations, " +
      "multiple examples, edge cases, and connections to related concepts.",
  };
  fragments.push(depthMap[profile.explanationDepth]);

  // ── Mentor tone ───────────────────────────────────────────────────
  const toneMap: Record<LearnerProfile["mentorTone"], string> = {
    encouraging:
      "Celebrate progress and correct answers. Be patient with mistakes. " +
      "Use positive reinforcement: acknowledge effort before correcting errors.",
    neutral:
      "Be matter-of-fact. Focus on correctness and clarity. " +
      "Acknowledge right answers briefly, move on quickly.",
    challenging:
      "Push the student intellectually. Ask follow-up 'but why?' questions. " +
      "Raise the bar after correct answers. Don't over-praise — respect their capacity.",
  };
  fragments.push(toneMap[profile.mentorTone]);

  // ── Expertise domains (for cross-domain analogies) ────────────────
  if (profile.expertiseDomains.length > 0) {
    fragments.push(
      `The student has expertise in: ${profile.expertiseDomains.join(", ")}. ` +
        `When explaining new concepts, draw analogies from these domains to build bridges.`
    );
  }

  // ── Learning motivations ──────────────────────────────────────────
  if (profile.learningMotivations.length > 0) {
    const motivationHints: Record<string, string> = {
      career: "Frame concepts in terms of professional applicability and industry relevance.",
      curiosity: "Highlight what's surprising, counterintuitive, or elegant about each concept.",
      exam: "Emphasize testable knowledge, common question patterns, and memorization hooks.",
      hobby: "Keep it fun and low-pressure. Connect to real-world projects and creative applications.",
      academic: "Connect to broader theoretical frameworks and cite foundational research where relevant.",
    };
    const hints = profile.learningMotivations
      .map((m) => motivationHints[m])
      .filter(Boolean);
    if (hints.length > 0) fragments.push(hints.join(" "));
  }

  // ── Bloom's level ceiling (from calibration) ─────────────────────
  if (profile.inferredBloomCeiling && profile.calibrationConfidence > 0.3) {
    const bloomOrder = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
    const idx = bloomOrder.indexOf(profile.inferredBloomCeiling);
    if (idx >= 0 && idx < 3) {
      fragments.push(
        "Focus questions on recall, understanding, and basic application. " +
          "Avoid analysis/evaluation tasks until the student demonstrates readiness."
      );
    }
  }

  // ── Pacing (from calibration) ─────────────────────────────────────
  if (profile.inferredPace && profile.calibrationConfidence > 0.3) {
    const paceMap: Record<string, string> = {
      slow:
        "This student benefits from a slower pace. Repeat key points. " +
        "Check understanding after each step before moving on.",
      medium: "",
      fast:
        "This student learns quickly. You can move faster through basics " +
        "and spend more time on advanced nuances and edge cases.",
    };
    const hint = paceMap[profile.inferredPace];
    if (hint) fragments.push(hint);
  }

  // ── Accessibility ─────────────────────────────────────────────────
  const a11y = profile.accessibilityNeeds;
  if (a11y.dyslexia) {
    fragments.push(
      "Keep paragraphs short (3-4 sentences max). Use bullet lists extensively. " +
        "Avoid dense text blocks. Bold key terms for scannability."
    );
  }
  if (a11y.adhd) {
    fragments.push(
      "Include frequent micro-checkpoints ('Does this make sense so far?'). " +
        "Keep individual explanations focused on one idea. " +
        "Use the retrieve → teach → quick-quiz → reward cycle to maintain engagement."
    );
  }
  if (a11y.visualImpairment) {
    fragments.push(
      "Describe any diagrams or visual concepts in detail using text. " +
        "Use structured headings and numbered lists for navigation."
    );
  }

  return `--- LEARNER PERSONA ---\n${fragments.join("\n")}\n--- END PERSONA ---`;
}

function stageToReadingLevel(stage: LearnerProfile["educationStage"]): number {
  const map: Record<string, number> = {
    elementary: 4,
    high_school: 9,
    university: 13,
    professional: 15,
    self_learner: 12,
  };
  return map[stage] ?? 12;
}
