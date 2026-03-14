import {
  db,
  courseModules,
  courseLessons,
  lessonBlocks,
  userConceptState,
  learningGoals,
  concepts,
} from "@repo/db";
import { eq, and, asc, inArray, lte } from "drizzle-orm";
import type { ModuleStatus } from "@repo/shared";

const MASTERY_GATE_THRESHOLD = 0.7;
const SKIP_ELIGIBLE_THRESHOLD = 0.9;
const RE_ENGAGEMENT_DAYS = 3;

type ModuleWithStatus = {
  id: string;
  goalId: string;
  sequenceOrder: number;
  title: string;
  description: string | null;
  moduleType: string;
  conceptIds: string[];
  unlockRule: unknown;
  estimatedMinutes: number | null;
  status: string | null;
};

type LessonWithBlocks = {
  id: string;
  moduleId: string;
  sequenceOrder: number;
  title: string;
  lessonType: string;
  estimatedMinutes: number | null;
  status: string | null;
  blocks: {
    id: string;
    sequenceOrder: number;
    blockType: string;
    bloomLevel: string | null;
    generatedContent: unknown;
    status: string | null;
  }[];
};

export type NextLessonResult =
  | { type: "lesson"; lesson: LessonWithBlocks; module: ModuleWithStatus }
  | { type: "remedial_needed"; lockedModule: ModuleWithStatus; weakConcepts: string[] }
  | { type: "course_complete" }
  | { type: "no_modules" };

export async function getNextLesson(
  goalId: string,
  userId: string,
): Promise<NextLessonResult> {
  const modules = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.goalId, goalId))
    .orderBy(asc(courseModules.sequenceOrder));

  if (modules.length === 0) return { type: "no_modules" };

  // Find first available or in-progress module
  let targetModule = modules.find(
    (m) => m.status === "in_progress" || m.status === "available",
  );

  if (!targetModule) {
    // Check if there are locked modules that could be unlocked
    for (const mod of modules) {
      if (mod.status === "locked") {
        const evaluation = await evaluateModuleStatus(mod.id, userId);
        if (evaluation === "available") {
          await db
            .update(courseModules)
            .set({ status: "available" })
            .where(eq(courseModules.id, mod.id));
          targetModule = { ...mod, status: "available" };
          break;
        }
        if (evaluation === "locked") {
          const weakConcepts = await getWeakConceptsForModule(mod, userId);
          if (weakConcepts.length > 0) {
            return { type: "remedial_needed", lockedModule: mod as ModuleWithStatus, weakConcepts };
          }
        }
      }
    }
  }

  if (!targetModule) {
    const allCompleted = modules.every(
      (m) => m.status === "completed" || m.status === "skipped",
    );
    if (allCompleted) return { type: "course_complete" };
    return { type: "no_modules" };
  }

  // Mark as in_progress if currently available
  if (targetModule.status === "available") {
    await db
      .update(courseModules)
      .set({ status: "in_progress" })
      .where(eq(courseModules.id, targetModule.id));
  }

  const lessons = await db
    .select()
    .from(courseLessons)
    .where(eq(courseLessons.moduleId, targetModule.id))
    .orderBy(asc(courseLessons.sequenceOrder));

  const nextLesson = lessons.find(
    (l) => l.status === "pending" || l.status === "in_progress",
  );

  if (!nextLesson) {
    // Module is complete — mark it and recurse
    await db
      .update(courseModules)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(courseModules.id, targetModule.id));

    // Unlock next modules
    await unlockDependentModules(goalId, userId);

    return getNextLesson(goalId, userId);
  }

  const blocks = await db
    .select()
    .from(lessonBlocks)
    .where(eq(lessonBlocks.lessonId, nextLesson.id))
    .orderBy(asc(lessonBlocks.sequenceOrder));

  return {
    type: "lesson",
    lesson: { ...nextLesson, blocks } as LessonWithBlocks,
    module: targetModule as ModuleWithStatus,
  };
}

export async function evaluateModuleStatus(
  moduleId: string,
  userId: string,
): Promise<ModuleStatus> {
  const [mod] = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.id, moduleId))
    .limit(1);

  if (!mod) return "locked";
  if (mod.status === "completed" || mod.status === "skipped") {
    return mod.status as ModuleStatus;
  }

  const unlockRule = mod.unlockRule as {
    type?: string;
    moduleTitles?: string[];
  } | null;

  if (!unlockRule || !unlockRule.moduleTitles?.length) return "available";

  // Check if prerequisite modules are completed
  const prereqModules = await db
    .select()
    .from(courseModules)
    .where(
      and(
        eq(courseModules.goalId, mod.goalId),
        inArray(courseModules.title, unlockRule.moduleTitles),
      ),
    );

  const allPrereqsDone = prereqModules.every(
    (p) => p.status === "completed" || p.status === "skipped",
  );

  if (!allPrereqsDone) return "locked";

  // Check concept mastery for the prerequisite concepts
  if (mod.conceptIds && mod.conceptIds.length > 0) {
    const conceptStates = await db
      .select()
      .from(userConceptState)
      .where(
        and(
          eq(userConceptState.userId, userId),
          inArray(userConceptState.conceptId, mod.conceptIds),
        ),
      );

    const avgRetrievability =
      conceptStates.length > 0
        ? conceptStates.reduce((s, c) => s + (c.fsrsRetrievability ?? 0), 0) /
          conceptStates.length
        : 0;

    if (avgRetrievability < MASTERY_GATE_THRESHOLD && conceptStates.length > 0) {
      return "locked";
    }
  }

  return "available";
}

export async function isModuleSkipEligible(
  moduleId: string,
  userId: string,
): Promise<boolean> {
  const [mod] = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.id, moduleId))
    .limit(1);

  if (!mod?.conceptIds?.length) return false;

  const conceptStates = await db
    .select()
    .from(userConceptState)
    .where(
      and(
        eq(userConceptState.userId, userId),
        inArray(userConceptState.conceptId, mod.conceptIds),
      ),
    );

  if (conceptStates.length < mod.conceptIds.length) return false;

  return conceptStates.every(
    (c) => (c.fsrsRetrievability ?? 0) >= SKIP_ELIGIBLE_THRESHOLD,
  );
}

export async function getCourseRoadmap(goalId: string, userId: string) {
  const modules = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.goalId, goalId))
    .orderBy(asc(courseModules.sequenceOrder));

  const result = await Promise.all(
    modules.map(async (mod) => {
      const lessons = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.moduleId, mod.id))
        .orderBy(asc(courseLessons.sequenceOrder));

      const lessonDetails = await Promise.all(
        lessons.map(async (lesson) => {
          const blocks = await db
            .select({
              id: lessonBlocks.id,
              blockType: lessonBlocks.blockType,
              status: lessonBlocks.status,
            })
            .from(lessonBlocks)
            .where(eq(lessonBlocks.lessonId, lesson.id))
            .orderBy(asc(lessonBlocks.sequenceOrder));

          const completedBlocks = blocks.filter((b) => b.status === "completed").length;

          return {
            ...lesson,
            blockCount: blocks.length,
            completedBlocks,
            blockTypes: blocks.map((b) => b.blockType),
          };
        }),
      );

      const totalLessons = lessonDetails.length;
      const completedLessons = lessonDetails.filter(
        (l) => l.status === "completed",
      ).length;
      const skipEligible = await isModuleSkipEligible(mod.id, userId);

      // Concept skill data for this module
      let conceptSkill = 0;
      let unlockRequirements: { conceptName: string; retrievability: number }[] = [];
      if (mod.conceptIds?.length) {
        const states = await db
          .select({
            conceptId: userConceptState.conceptId,
            retrievability: userConceptState.fsrsRetrievability,
          })
          .from(userConceptState)
          .where(
            and(
              eq(userConceptState.userId, userId),
              inArray(userConceptState.conceptId, mod.conceptIds),
            ),
          );

        const stateMap = new Map(states.map((s) => [s.conceptId, s.retrievability ?? 0]));
        const totalR = mod.conceptIds.reduce((s, cid) => s + (stateMap.get(cid) ?? 0), 0);
        conceptSkill = Math.round((totalR / mod.conceptIds.length) * 100);

        if (mod.status === "locked") {
          const conceptNames = await db
            .select({ id: concepts.id, name: concepts.displayName })
            .from(concepts)
            .where(inArray(concepts.id, mod.conceptIds));

          const nameMap = new Map(conceptNames.map((c) => [c.id, c.name]));
          unlockRequirements = mod.conceptIds
            .filter((cid) => (stateMap.get(cid) ?? 0) < MASTERY_GATE_THRESHOLD)
            .map((cid) => ({
              conceptName: nameMap.get(cid) ?? "Unknown concept",
              retrievability: Math.round((stateMap.get(cid) ?? 0) * 100),
            }));
        }
      }

      return {
        ...mod,
        lessons: lessonDetails,
        totalLessons,
        completedLessons,
        progressPercent:
          totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        skipEligible,
        conceptSkill,
        unlockRequirements,
      };
    }),
  );

  return result;
}

async function getWeakConceptsForModule(
  mod: { conceptIds: string[] | null },
  userId: string,
): Promise<string[]> {
  if (!mod.conceptIds?.length) return [];
  const states = await db
    .select()
    .from(userConceptState)
    .where(
      and(
        eq(userConceptState.userId, userId),
        inArray(userConceptState.conceptId, mod.conceptIds),
      ),
    );
  return states
    .filter((s) => (s.fsrsRetrievability ?? 0) < MASTERY_GATE_THRESHOLD)
    .map((s) => s.conceptId);
}

export type CatchUpSuggestion = {
  type: "catch_up";
  weakConcepts: { conceptId: string; conceptName: string; retrievability: number }[];
  targetModuleTitle: string;
};

export async function generateCatchUpSuggestion(
  goalId: string,
  userId: string,
): Promise<CatchUpSuggestion | null> {
  const lockedModules = await db
    .select()
    .from(courseModules)
    .where(and(eq(courseModules.goalId, goalId), eq(courseModules.status, "locked")))
    .orderBy(asc(courseModules.sequenceOrder))
    .limit(1);

  const lockedMod = lockedModules[0];
  if (!lockedMod?.conceptIds?.length) return null;

  const states = await db
    .select({
      conceptId: userConceptState.conceptId,
      retrievability: userConceptState.fsrsRetrievability,
    })
    .from(userConceptState)
    .where(
      and(
        eq(userConceptState.userId, userId),
        inArray(userConceptState.conceptId, lockedMod.conceptIds),
      ),
    );

  const stateMap = new Map(states.map((s) => [s.conceptId, s.retrievability ?? 0]));
  const weakIds = lockedMod.conceptIds.filter(
    (cid) => (stateMap.get(cid) ?? 0) < MASTERY_GATE_THRESHOLD,
  );

  if (weakIds.length === 0) return null;

  const conceptNames = await db
    .select({ id: concepts.id, name: concepts.displayName })
    .from(concepts)
    .where(inArray(concepts.id, weakIds));

  const nameMap = new Map(conceptNames.map((c) => [c.id, c.name]));

  return {
    type: "catch_up",
    weakConcepts: weakIds.map((cid) => ({
      conceptId: cid,
      conceptName: nameMap.get(cid) ?? "Unknown concept",
      retrievability: Math.round((stateMap.get(cid) ?? 0) * 100),
    })),
    targetModuleTitle: lockedMod.title,
  };
}

export type WelcomeBackResult = {
  type: "welcome_back";
  daysSinceActivity: number;
  decayedConcepts: { conceptId: string; conceptName: string; retrievability: number }[];
  goalId: string;
  goalTitle: string;
};

export async function getWelcomeBackSuggestion(
  userId: string,
): Promise<WelcomeBackResult | null> {
  const activeGoals = await db
    .select()
    .from(learningGoals)
    .where(
      and(
        eq(learningGoals.userId, userId),
        eq(learningGoals.status, "active"),
      ),
    )
    .orderBy(asc(learningGoals.createdAt))
    .limit(1);

  const goal = activeGoals[0];
  if (!goal) return null;

  const now = new Date();
  const cutoff = new Date(now.getTime() - RE_ENGAGEMENT_DAYS * 24 * 60 * 60 * 1000);

  const decayedConcepts = await db
    .select({
      conceptId: userConceptState.conceptId,
      retrievability: userConceptState.fsrsRetrievability,
    })
    .from(userConceptState)
    .where(
      and(
        eq(userConceptState.userId, userId),
        lte(userConceptState.nextReviewAt, cutoff),
      ),
    )
    .limit(10);

  if (decayedConcepts.length === 0) return null;

  const conceptIds = decayedConcepts.map((c) => c.conceptId);
  const conceptNames = await db
    .select({ id: concepts.id, name: concepts.displayName })
    .from(concepts)
    .where(inArray(concepts.id, conceptIds));

  const nameMap = new Map(conceptNames.map((c) => [c.id, c.name]));

  const lastReview = decayedConcepts.reduce(
    (latest, c) => Math.min(latest, c.retrievability ?? 0),
    1,
  );

  return {
    type: "welcome_back",
    daysSinceActivity: RE_ENGAGEMENT_DAYS,
    decayedConcepts: decayedConcepts.map((c) => ({
      conceptId: c.conceptId,
      conceptName: nameMap.get(c.conceptId) ?? "Unknown concept",
      retrievability: Math.round((c.retrievability ?? 0) * 100),
    })),
    goalId: goal.id,
    goalTitle: goal.title,
  };
}

async function unlockDependentModules(goalId: string, userId: string) {
  const modules = await db
    .select()
    .from(courseModules)
    .where(and(eq(courseModules.goalId, goalId), eq(courseModules.status, "locked")));

  for (const mod of modules) {
    const status = await evaluateModuleStatus(mod.id, userId);
    if (status === "available") {
      await db
        .update(courseModules)
        .set({ status: "available" })
        .where(eq(courseModules.id, mod.id));
    }
  }
}
