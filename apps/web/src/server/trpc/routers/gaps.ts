import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  userConceptState,
  concepts,
  conceptEdges,
  learningGoals,
  courseModules,
  courseLessons,
  lessonBlocks,
} from "@repo/db";
import { eq, and, sql, inArray } from "drizzle-orm";

type GapItem = {
  conceptId: string;
  conceptName: string;
  definition: string | null;
  mastery: number;
  retrievability: number;
  priority: number;
  prerequisiteFor: string[];
  domain: string | null;
};

function topoSort(conceptIds: Set<string>, edges: { source: string; target: string }[]): string[] {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const id of conceptIds) {
    adj.set(id, []);
    inDeg.set(id, 0);
  }

  for (const e of edges) {
    if (conceptIds.has(e.source) && conceptIds.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      const newDeg = (inDeg.get(neighbor) ?? 1) - 1;
      inDeg.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  for (const id of conceptIds) {
    if (!sorted.includes(id)) sorted.push(id);
  }

  return sorted;
}

function countDownstream(conceptId: string, edges: { source: string; target: string }[]): number {
  const visited = new Set<string>();
  const stack = [conceptId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const e of edges) {
      if (e.source === current && !visited.has(e.target)) {
        stack.push(e.target);
      }
    }
  }
  return visited.size - 1;
}

export const gapsRouter = createTRPCRouter({
  detectGaps: protectedProcedure
    .input(
      z.object({
        goalId: z.string().uuid().optional(),
        learningObjectId: z.string().uuid().optional(),
        targetConceptIds: z.array(z.string().uuid()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let targetConceptIds: string[] = [];

      if (input.targetConceptIds?.length) {
        targetConceptIds = input.targetConceptIds;
      } else if (input.goalId) {
        const blocks = await db
          .select({ conceptIds: lessonBlocks.conceptIds })
          .from(lessonBlocks)
          .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
          .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
          .innerJoin(learningGoals, eq(learningGoals.id, courseModules.goalId))
          .where(
            and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId))
          );
        const idSet = new Set<string>();
        for (const b of blocks) {
          for (const cid of b.conceptIds ?? []) idSet.add(cid);
        }
        targetConceptIds = Array.from(idSet);
      }

      const prereqEdges = await db
        .select({ source: conceptEdges.sourceId, target: conceptEdges.targetId })
        .from(conceptEdges)
        .where(eq(conceptEdges.edgeType, "prerequisite"));

      const allRelevantIds = new Set(targetConceptIds);
      for (const e of prereqEdges) {
        if (allRelevantIds.has(e.target)) allRelevantIds.add(e.source);
      }

      if (allRelevantIds.size === 0) {
        const allStates = await db
          .select({
            conceptId: userConceptState.conceptId,
            mastery: userConceptState.masteryLevel,
            retrievability: userConceptState.fsrsRetrievability,
            conceptName: concepts.displayName,
            definition: concepts.definition,
            domain: concepts.domain,
          })
          .from(userConceptState)
          .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
          .where(
            and(
              eq(userConceptState.userId, ctx.userId),
              sql`COALESCE(${userConceptState.masteryLevel}, 0) <= 2`
            )
          );

        return {
          gaps: allStates
            .map((s) => ({
              conceptId: s.conceptId,
              conceptName: s.conceptName,
              definition: s.definition,
              mastery: s.mastery ?? 0,
              retrievability: s.retrievability ?? 0,
              priority: (5 - (s.mastery ?? 0)) * 10,
              prerequisiteFor: [] as string[],
              domain: s.domain,
            }))
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 20),
          totalGaps: allStates.length,
          topologicalOrder: [] as string[],
        };
      }

      const relevantIds = Array.from(allRelevantIds);
      const states = await db
        .select({
          conceptId: userConceptState.conceptId,
          mastery: userConceptState.masteryLevel,
          retrievability: userConceptState.fsrsRetrievability,
        })
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            inArray(userConceptState.conceptId, relevantIds)
          )
        );

      const stateMap = new Map(states.map((s) => [s.conceptId, s]));

      const gapConceptIds = relevantIds.filter((id) => {
        const state = stateMap.get(id);
        return !state || (state.mastery ?? 0) <= 2;
      });

      if (gapConceptIds.length === 0) {
        return { gaps: [], totalGaps: 0, topologicalOrder: [] };
      }

      const conceptRows = await db
        .select({
          id: concepts.id,
          name: concepts.displayName,
          definition: concepts.definition,
          domain: concepts.domain,
        })
        .from(concepts)
        .where(inArray(concepts.id, gapConceptIds));

      const conceptMap = new Map(conceptRows.map((c) => [c.id, c]));

      const prereqForMap = new Map<string, string[]>();
      for (const e of prereqEdges) {
        if (gapConceptIds.includes(e.source)) {
          const list = prereqForMap.get(e.source) ?? [];
          const targetConcept = conceptRows.find((c) => c.id === e.target)?.name;
          if (targetConcept) list.push(targetConcept);
          prereqForMap.set(e.source, list);
        }
      }

      const gaps: GapItem[] = gapConceptIds.map((id) => {
        const concept = conceptMap.get(id);
        const state = stateMap.get(id);
        const mastery = state?.mastery ?? 0;
        const retrievability = state?.retrievability ?? 0;
        const downstream = countDownstream(id, prereqEdges);
        const masteryDeficit = 5 - mastery;
        const decayPenalty = 1 - retrievability;
        const priority = downstream * masteryDeficit * (1 + decayPenalty);

        return {
          conceptId: id,
          conceptName: concept?.name ?? "Unknown",
          definition: concept?.definition ?? null,
          mastery,
          retrievability,
          priority: Math.round(priority * 100) / 100,
          prerequisiteFor: prereqForMap.get(id) ?? [],
          domain: concept?.domain ?? null,
        };
      });

      gaps.sort((a, b) => b.priority - a.priority);

      const gapSet = new Set(gapConceptIds);
      const sortedOrder = topoSort(gapSet, prereqEdges);

      return {
        gaps: gaps.slice(0, 20),
        totalGaps: gaps.length,
        topologicalOrder: sortedOrder,
      };
    }),

  getPrerequisiteCheck: protectedProcedure
    .input(z.object({ conceptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const prereqEdges = await db
        .select({
          sourceId: conceptEdges.sourceId,
          sourceName: concepts.displayName,
        })
        .from(conceptEdges)
        .innerJoin(concepts, eq(conceptEdges.sourceId, concepts.id))
        .where(
          and(eq(conceptEdges.targetId, input.conceptId), eq(conceptEdges.edgeType, "prerequisite"))
        );

      if (prereqEdges.length === 0) return { ready: true, missingPrereqs: [] };

      const prereqIds = prereqEdges.map((e) => e.sourceId);
      const states = await db
        .select({
          conceptId: userConceptState.conceptId,
          mastery: userConceptState.masteryLevel,
        })
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            inArray(userConceptState.conceptId, prereqIds)
          )
        );

      const stateMap = new Map(states.map((s) => [s.conceptId, s.mastery ?? 0]));

      const missing = prereqEdges
        .filter((e) => (stateMap.get(e.sourceId) ?? 0) < 3)
        .map((e) => ({
          conceptId: e.sourceId,
          conceptName: e.sourceName,
          mastery: stateMap.get(e.sourceId) ?? 0,
        }));

      return {
        ready: missing.length === 0,
        missingPrereqs: missing,
      };
    }),
});
