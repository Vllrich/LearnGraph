import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  suggestionDismissals,
  learningGoals,
  learnerProfiles,
  concepts,
  userConceptState,
  conceptEdges,
} from "@repo/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  generatePersonalizedTopics,
  generateTopicHook,
  type PersonalizedTopic,
} from "@repo/ai";
import type { LearnerProfile, EducationStage } from "@repo/shared";

const SUGGESTION_TYPES = ["ai_topic", "trending", "gap", "random"] as const;
type SuggestionType = (typeof SUGGESTION_TYPES)[number];

const DEFAULT_LEARNER_PROFILE: LearnerProfile = {
  educationStage: "self_learner",
  nativeLanguage: "en",
  contentLanguage: "en",
  communicationStyle: "balanced",
  explanationDepth: "standard",
  mentorTone: "encouraging",
  expertiseDomains: [],
  learningMotivations: [],
  accessibilityNeeds: {},
  inferredReadingLevel: null,
  inferredOptimalSessionMin: null,
  inferredBloomCeiling: null,
  inferredPace: null,
  calibrationConfidence: 0,
};

function rowToProfile(
  row: typeof learnerProfiles.$inferSelect
): LearnerProfile {
  return {
    educationStage: row.educationStage as EducationStage,
    nativeLanguage: row.nativeLanguage,
    contentLanguage: row.contentLanguage,
    communicationStyle:
      row.communicationStyle as LearnerProfile["communicationStyle"],
    explanationDepth:
      row.explanationDepth as LearnerProfile["explanationDepth"],
    mentorTone: row.mentorTone as LearnerProfile["mentorTone"],
    expertiseDomains: row.expertiseDomains ?? [],
    learningMotivations: (row.learningMotivations ??
      []) as LearnerProfile["learningMotivations"],
    accessibilityNeeds: (row.accessibilityNeeds ??
      {}) as LearnerProfile["accessibilityNeeds"],
    inferredReadingLevel: row.inferredReadingLevel,
    inferredOptimalSessionMin: row.inferredOptimalSessionMin,
    inferredBloomCeiling:
      row.inferredBloomCeiling as LearnerProfile["inferredBloomCeiling"],
    inferredPace: row.inferredPace as LearnerProfile["inferredPace"],
    calibrationConfidence: row.calibrationConfidence ?? 0,
  };
}

function normalizeKey(key: string): string {
  return key.toLowerCase().trim();
}

async function getDismissedKeys(
  userId: string,
  type?: SuggestionType
): Promise<Set<string>> {
  const conditions = [eq(suggestionDismissals.userId, userId)];
  if (type) conditions.push(eq(suggestionDismissals.suggestionType, type));

  const rows = await db
    .select({ key: suggestionDismissals.suggestionKey })
    .from(suggestionDismissals)
    .where(and(...conditions));

  return new Set(rows.map((r) => r.key));
}

async function getTrendingTopics(
  dismissedKeys: Set<string>,
  limit: number
): Promise<{ title: string; enrollCount: number }[]> {
  const rows = await db
    .select({
      title: learningGoals.title,
      enrollCount: sql<number>`count(*)::int`,
    })
    .from(learningGoals)
    .where(sql`${learningGoals.createdAt} > now() - interval '30 days'`)
    .groupBy(learningGoals.title)
    .orderBy(desc(sql`count(*)`))
    .limit(30);

  return rows
    .filter((r) => !dismissedKeys.has(normalizeKey(r.title)))
    .slice(0, limit);
}

async function getGapSuggestions(
  userId: string,
  dismissedKeys: Set<string>,
  limit: number
): Promise<
  {
    conceptId: string;
    conceptName: string;
    domain: string | null;
    prerequisiteFor: string[];
    mastery: number;
  }[]
> {
  const goalRows = await db
    .select({ id: learningGoals.id, title: learningGoals.title })
    .from(learningGoals)
    .where(
      and(eq(learningGoals.userId, userId), eq(learningGoals.status, "active"))
    );

  if (goalRows.length === 0) return [];

  const states = await db
    .select({
      conceptId: userConceptState.conceptId,
      mastery: userConceptState.masteryLevel,
      conceptName: concepts.displayName,
      domain: concepts.domain,
    })
    .from(userConceptState)
    .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
    .where(
      and(
        eq(userConceptState.userId, userId),
        sql`COALESCE(${userConceptState.masteryLevel}, 0) <= 2`
      )
    );

  if (states.length === 0) return [];

  const weakIds = states.map((s) => s.conceptId);
  const prereqEdges = await db
    .select({
      sourceId: conceptEdges.sourceId,
      targetId: conceptEdges.targetId,
    })
    .from(conceptEdges)
    .where(
      and(
        eq(conceptEdges.edgeType, "prerequisite"),
        inArray(conceptEdges.sourceId, weakIds)
      )
    );

  const prereqForMap = new Map<string, string[]>();
  const targetConceptIds = new Set(prereqEdges.map((e) => e.targetId));
  let targetNameMap = new Map<string, string>();

  if (targetConceptIds.size > 0) {
    const targetRows = await db
      .select({ id: concepts.id, name: concepts.displayName })
      .from(concepts)
      .where(inArray(concepts.id, Array.from(targetConceptIds)));
    targetNameMap = new Map(targetRows.map((r) => [r.id, r.name]));
  }

  for (const e of prereqEdges) {
    const list = prereqForMap.get(e.sourceId) ?? [];
    const name = targetNameMap.get(e.targetId);
    if (name) list.push(name);
    prereqForMap.set(e.sourceId, list);
  }

  return states
    .filter((s) => !dismissedKeys.has(normalizeKey(s.conceptName)))
    .sort(
      (a, b) =>
        (prereqForMap.get(b.conceptId)?.length ?? 0) -
        (prereqForMap.get(a.conceptId)?.length ?? 0)
    )
    .slice(0, limit)
    .map((s) => ({
      conceptId: s.conceptId,
      conceptName: s.conceptName,
      domain: s.domain,
      prerequisiteFor: prereqForMap.get(s.conceptId) ?? [],
      mastery: s.mastery ?? 0,
    }));
}

export const discoveryRouter = createTRPCRouter({
  getSuggestions: protectedProcedure.query(async ({ ctx }) => {
    const allDismissed = await getDismissedKeys(ctx.userId);

    const [profileRow] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, ctx.userId))
      .limit(1);
    const profile = profileRow
      ? rowToProfile(profileRow)
      : DEFAULT_LEARNER_PROFILE;
    const hasProfile = !!profileRow;

    const goalRows = await db
      .select({ title: learningGoals.title })
      .from(learningGoals)
      .where(
        and(
          eq(learningGoals.userId, ctx.userId),
          eq(learningGoals.status, "active")
        )
      );
    const existingTitles = goalRows.map((g) => g.title);

    const [forYou, trending, gaps] = await Promise.all([
      generatePersonalizedTopics(
        profile,
        existingTitles,
        Array.from(allDismissed),
        8
      ).catch((err) => {
        console.error("[discovery] AI topic generation failed:", err);
        return [] as PersonalizedTopic[];
      }),
      getTrendingTopics(allDismissed, 6),
      getGapSuggestions(ctx.userId, allDismissed, 4),
    ]);

    return { forYou, trending, gaps, hasProfile };
  }),

  dismiss: protectedProcedure
    .input(
      z.object({
        suggestionType: z.enum(SUGGESTION_TYPES),
        suggestionKey: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = normalizeKey(input.suggestionKey);

      await db
        .insert(suggestionDismissals)
        .values({
          userId: ctx.userId,
          suggestionType: input.suggestionType,
          suggestionKey: key,
        })
        .onConflictDoNothing();

      return { dismissed: true };
    }),

  getRandomTopic: protectedProcedure.query(async ({ ctx }) => {
    const dismissed = await getDismissedKeys(ctx.userId, "random");
    const existingGoals = await db
      .select({ title: learningGoals.title })
      .from(learningGoals)
      .where(eq(learningGoals.userId, ctx.userId));
    const excludeTitles = new Set([
      ...Array.from(dismissed),
      ...existingGoals.map((g) => normalizeKey(g.title)),
    ]);

    const randomRows = await db
      .select({
        id: concepts.id,
        name: concepts.displayName,
        domain: concepts.domain,
      })
      .from(concepts)
      .where(sql`${concepts.id} NOT IN (
        SELECT concept_id FROM user_concept_state WHERE user_id = ${ctx.userId}
      )`)
      .orderBy(sql`random()`)
      .limit(10);

    const candidate = randomRows.find(
      (r) => !excludeTitles.has(normalizeKey(r.name))
    );

    if (!candidate) {
      return null;
    }

    try {
      const hook = await generateTopicHook(candidate.name, candidate.domain);
      return {
        title: candidate.name,
        hook: hook.hook,
        subtitle: hook.subtitle,
        domain: candidate.domain,
      };
    } catch (err) {
      console.error("[discovery] Hook generation failed:", err);
      return {
        title: candidate.name,
        hook: `Discover the fascinating world of ${candidate.name}`,
        subtitle: candidate.domain ?? "Explore something new",
        domain: candidate.domain,
      };
    }
  }),
});
