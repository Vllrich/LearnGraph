import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  suggestionDismissals,
  learningGoals,
  concepts,
  userConceptState,
  conceptEdges,
} from "@repo/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { generateTopicHook } from "@repo/ai";

const SUGGESTION_TYPES = ["ai_topic", "trending", "gap", "random"] as const;
type SuggestionType = (typeof SUGGESTION_TYPES)[number];

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
  const [goalRows, states] = await Promise.all([
    db
      .select({ id: learningGoals.id })
      .from(learningGoals)
      .where(
        and(eq(learningGoals.userId, userId), eq(learningGoals.status, "active"))
      )
      .limit(1),
    db
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
      ),
  ]);

  if (goalRows.length === 0 || states.length === 0) return [];

  const weakIds = states.map((s) => s.conceptId);

  // Single joined query: prerequisite edges + target concept names
  const prereqRows = await db
    .select({
      sourceId: conceptEdges.sourceId,
      targetName: concepts.displayName,
    })
    .from(conceptEdges)
    .innerJoin(concepts, eq(concepts.id, conceptEdges.targetId))
    .where(
      and(
        eq(conceptEdges.edgeType, "prerequisite"),
        inArray(conceptEdges.sourceId, weakIds)
      )
    );

  const prereqForMap = new Map<string, string[]>();
  for (const row of prereqRows) {
    const list = prereqForMap.get(row.sourceId) ?? [];
    list.push(row.targetName);
    prereqForMap.set(row.sourceId, list);
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
    const allDismissed = await getDismissedKeys(ctx.userId).catch(() => new Set<string>());

    const [trending, gaps] = await Promise.all([
      getTrendingTopics(allDismissed, 6).catch(() => []),
      getGapSuggestions(ctx.userId, allDismissed, 4).catch(() => []),
    ]);

    return { trending, gaps };
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
