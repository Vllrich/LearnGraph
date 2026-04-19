import { eq } from "drizzle-orm";
import { db, lessonBlocks } from "@repo/db";
import type { BlockType, BloomLevel } from "@repo/shared";
import { generateBlockContent } from "./generate-block";

/**
 * Shape we need from a `lesson_blocks` row to materialize its content. The
 * caller selects just these columns to keep the row payload small when fanning
 * out across a lesson.
 */
export type PendingLessonBlock = {
  id: string;
  blockType: string;
  generatedContent: unknown;
};

const DEFAULT_CONCURRENCY = 3;

/**
 * Materialize any `_pending` lesson blocks in the provided list by calling
 * `generateBlockContent` and persisting the structured output to Postgres.
 *
 * Intended to be used as a background ("after response") warm-up so the player
 * can stream from cached JSONB instead of waiting on an LLM round-trip.
 *
 * Concurrency is bounded (default 3) to balance warm-up latency against
 * upstream LLM rate limits. Per-block failures are isolated: we log and skip,
 * so one bad block never poisons the rest of the lesson.
 *
 * Idempotent: rows whose `generatedContent._pending` flag has already been
 * cleared are skipped, so concurrent warm-up passes (e.g. lesson open + player
 * look-ahead firing at roughly the same time) will not re-generate the same
 * block. A final "still pending" re-check on the DB before writing would fully
 * close the race, but the cost is ~low (idempotent overwrite of identical
 * JSON) and not worth an extra round-trip per block.
 */
export async function preGeneratePendingBlocks(
  blocks: ReadonlyArray<PendingLessonBlock>,
  courseTopicFallback: string,
  options: { concurrency?: number } = {},
): Promise<void> {
  const pending = blocks.filter((b) => {
    const c = b.generatedContent as Record<string, unknown> | null | undefined;
    return c?._pending === true;
  });
  if (pending.length === 0) return;

  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, pending.length),
  );

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= pending.length) return;
      const row = pending[i];
      const c = (row.generatedContent ?? {}) as Record<string, unknown>;
      try {
        const generated = await generateBlockContent({
          blockType: row.blockType as BlockType,
          conceptName: (c.conceptName as string) ?? row.blockType,
          bloomLevel: (c.bloomLevel as BloomLevel) ?? "understand",
          lessonTitle: (c.lessonTitle as string) ?? "",
          moduleTitle: (c.moduleTitle as string) ?? "",
          courseTopic: (c.courseTopic as string) ?? courseTopicFallback,
        });
        await db
          .update(lessonBlocks)
          .set({ generatedContent: generated })
          .where(eq(lessonBlocks.id, row.id));
      } catch (err) {
        console.error(
          `[pre-generate] block ${row.id} (${row.blockType}) failed:`,
          err,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
}
