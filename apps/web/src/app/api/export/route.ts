import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  db,
  learningObjects,
  concepts,
  conceptEdges,
  userConceptState,
  reviewLog,
  mentorConversations,
  questions,
} from "@repo/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { MASTERY_LABELS } from "@repo/shared";
import type { MasteryLevel } from "@repo/shared";

export const maxDuration = 60;

const exportSchema = z.object({
  type: z.enum(["summary", "flashcards", "graph", "conversations", "bulk"]),
  format: z.enum(["markdown", "json", "csv"]).default("markdown"),
  learningObjectId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = exportSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, format, learningObjectId } = parsed.data;

  try {
    switch (type) {
      case "summary":
        return await exportSummary(user.id, format, learningObjectId);
      case "flashcards":
        return await exportFlashcards(user.id, format, learningObjectId);
      case "graph":
        return await exportGraph(user.id, format);
      case "conversations":
        return await exportConversations(user.id, format, learningObjectId);
      case "bulk":
        return await exportBulk(user.id);
      default:
        return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }
  } catch (err) {
    console.error("Export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

async function exportSummary(userId: string, format: string, learningObjectId?: string) {
  const where = learningObjectId
    ? and(eq(learningObjects.id, learningObjectId), eq(learningObjects.userId, userId))
    : eq(learningObjects.userId, userId);

  const items = await db
    .select({
      id: learningObjects.id,
      title: learningObjects.title,
      sourceType: learningObjects.sourceType,
      summaryTldr: learningObjects.summaryTldr,
      summaryKeyPoints: learningObjects.summaryKeyPoints,
      summaryDeep: learningObjects.summaryDeep,
      createdAt: learningObjects.createdAt,
    })
    .from(learningObjects)
    .where(where)
    .orderBy(desc(learningObjects.createdAt));

  if (format === "json") {
    return jsonResponse(
      items.map((item) => ({
        ...item,
        summaryKeyPoints: safeParseJSON(item.summaryKeyPoints),
      })),
      `summaries-${Date.now()}.json`
    );
  }

  // Markdown
  let md = "# Learning Summaries\n\n";
  md += `_Exported on ${new Date().toLocaleDateString()}_\n\n---\n\n`;

  for (const item of items) {
    md += `## ${item.title}\n\n`;
    md += `**Type:** ${item.sourceType} | **Added:** ${item.createdAt?.toLocaleDateString() ?? "N/A"}\n\n`;

    if (item.summaryTldr) {
      md += `### TL;DR\n\n${item.summaryTldr}\n\n`;
    }

    const keyPoints = safeParseJSON(item.summaryKeyPoints);
    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
      md += `### Key Points\n\n`;
      for (const point of keyPoints) {
        md += `- ${point}\n`;
      }
      md += "\n";
    }

    if (item.summaryDeep) {
      md += `### Detailed Summary\n\n${item.summaryDeep}\n\n`;
    }

    md += "---\n\n";
  }

  return textResponse(md, `summaries-${Date.now()}.md`, "text/markdown");
}

async function exportFlashcards(userId: string, format: string, learningObjectId?: string) {
  const userLOs = learningObjectId
    ? [{ id: learningObjectId }]
    : await db
        .select({ id: learningObjects.id })
        .from(learningObjects)
        .where(eq(learningObjects.userId, userId));

  const loIds = userLOs.map((lo) => lo.id);
  if (loIds.length === 0) {
    return jsonResponse([], `flashcards-${Date.now()}.json`);
  }

  const cards = await db
    .select({
      id: questions.id,
      questionType: questions.questionType,
      questionText: questions.questionText,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      explanation: questions.explanation,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .where(inArray(questions.learningObjectId, loIds))
    .orderBy(questions.difficulty);

  if (format === "json") {
    return jsonResponse(cards, `flashcards-${Date.now()}.json`);
  }

  if (format === "csv") {
    // Anki-compatible TSV (tab-separated)
    const header = "Front\tBack\tTags\n";
    const rows = cards.map((c) => {
      const front = sanitizeTSV(c.questionText);
      const back = sanitizeTSV(
        c.correctAnswer
          ? `${c.correctAnswer}${c.explanation ? `\n\n${c.explanation}` : ""}`
          : (c.explanation ?? "")
      );
      const tags = `difficulty::${c.difficulty ?? 3} type::${c.questionType}`;
      return `${front}\t${back}\t${tags}`;
    });
    return textResponse(
      header + rows.join("\n"),
      `flashcards-${Date.now()}.txt`,
      "text/tab-separated-values"
    );
  }

  // Markdown
  let md = "# Flashcards\n\n";
  md += `_${cards.length} cards exported on ${new Date().toLocaleDateString()}_\n\n`;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    md += `### Card ${i + 1}\n\n`;
    md += `**Q:** ${c.questionText}\n\n`;
    if (c.correctAnswer) {
      md += `**A:** ${c.correctAnswer}\n\n`;
    }
    if (c.explanation) {
      md += `> ${c.explanation}\n\n`;
    }
    md += "---\n\n";
  }

  return textResponse(md, `flashcards-${Date.now()}.md`, "text/markdown");
}

async function exportGraph(userId: string, format: string) {
  // Get user's concepts with mastery states
  const conceptsWithMastery = await db
    .select({
      id: concepts.id,
      name: concepts.displayName,
      canonicalName: concepts.canonicalName,
      definition: concepts.definition,
      domain: concepts.domain,
      difficulty: concepts.difficultyLevel,
      bloomLevel: concepts.bloomLevel,
      mastery: userConceptState.masteryLevel,
      retrievability: userConceptState.fsrsRetrievability,
      nextReview: userConceptState.nextReviewAt,
    })
    .from(concepts)
    .innerJoin(
      userConceptState,
      and(eq(userConceptState.conceptId, concepts.id), eq(userConceptState.userId, userId))
    );

  const conceptIdSet = new Set(conceptsWithMastery.map((c) => c.id));

  const edges = await db
    .select({
      sourceId: conceptEdges.sourceId,
      targetId: conceptEdges.targetId,
      type: conceptEdges.edgeType,
      confidence: conceptEdges.confidence,
    })
    .from(conceptEdges);

  const relevantEdges = edges.filter(
    (e) => conceptIdSet.has(e.sourceId) && conceptIdSet.has(e.targetId)
  );

  if (format === "json") {
    return jsonResponse(
      {
        concepts: conceptsWithMastery.map((c) => ({
          ...c,
          masteryLabel: MASTERY_LABELS[(c.mastery ?? 0) as MasteryLevel],
        })),
        edges: relevantEdges,
        exportedAt: new Date().toISOString(),
      },
      `knowledge-graph-${Date.now()}.json`
    );
  }

  if (format === "csv") {
    let csv =
      "id,name,definition,domain,difficulty,bloom_level,mastery,mastery_label,retrievability\n";
    for (const c of conceptsWithMastery) {
      csv +=
        [
          c.id,
          csvEscape(c.name ?? ""),
          csvEscape(c.definition ?? ""),
          csvEscape(c.domain ?? ""),
          c.difficulty ?? "",
          c.bloomLevel ?? "",
          c.mastery ?? 0,
          MASTERY_LABELS[(c.mastery ?? 0) as MasteryLevel],
          c.retrievability?.toFixed(3) ?? "",
        ].join(",") + "\n";
    }

    csv += "\n# Edges\nsource_id,target_id,type,confidence\n";
    for (const e of relevantEdges) {
      csv += `${e.sourceId},${e.targetId},${e.type},${e.confidence}\n`;
    }

    return textResponse(csv, `knowledge-graph-${Date.now()}.csv`, "text/csv");
  }

  // Markdown
  let md = "# Knowledge Graph\n\n";
  md += `_${conceptsWithMastery.length} concepts, ${relevantEdges.length} connections_\n`;
  md += `_Exported on ${new Date().toLocaleDateString()}_\n\n`;

  md += "## Concepts\n\n";
  md += "| Concept | Mastery | Difficulty | Domain |\n";
  md += "|---------|---------|------------|--------|\n";
  for (const c of conceptsWithMastery) {
    md += `| ${c.name} | ${MASTERY_LABELS[(c.mastery ?? 0) as MasteryLevel]} | ${c.difficulty ?? "-"}/5 | ${c.domain ?? "-"} |\n`;
  }

  md += "\n## Connections\n\n";
  const conceptNameMap = new Map(conceptsWithMastery.map((c) => [c.id, c.name]));
  for (const e of relevantEdges) {
    md += `- ${conceptNameMap.get(e.sourceId) ?? e.sourceId} → ${conceptNameMap.get(e.targetId) ?? e.targetId} (${e.type})\n`;
  }

  return textResponse(md, `knowledge-graph-${Date.now()}.md`, "text/markdown");
}

async function exportConversations(userId: string, format: string, learningObjectId?: string) {
  const where = learningObjectId
    ? and(
        eq(mentorConversations.userId, userId),
        eq(mentorConversations.learningObjectId, learningObjectId)
      )
    : eq(mentorConversations.userId, userId);

  const convos = await db
    .select()
    .from(mentorConversations)
    .where(where)
    .orderBy(desc(mentorConversations.updatedAt));

  if (format === "json") {
    return jsonResponse(convos, `conversations-${Date.now()}.json`);
  }

  // Markdown
  let md = "# Conversation History\n\n";
  md += `_${convos.length} conversations exported on ${new Date().toLocaleDateString()}_\n\n`;

  for (const conv of convos) {
    md += `## ${conv.title ?? "Untitled Conversation"}\n\n`;
    md += `_${conv.createdAt?.toLocaleDateString() ?? "N/A"}_\n\n`;

    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    for (const msg of messages) {
      const m = msg as {
        role?: string;
        content?: string;
        citations?: Array<{ content?: string; pageNumber?: number }>;
      };
      if (m.role === "user") {
        md += `**You:** ${m.content}\n\n`;
      } else if (m.role === "assistant") {
        md += `**Mentor:** ${m.content}\n\n`;
        if (m.citations && m.citations.length > 0) {
          md += "_Sources:_ ";
          md += m.citations
            .map((c, i) => (c.pageNumber ? `[p.${c.pageNumber}]` : `[${i + 1}]`))
            .join(", ");
          md += "\n\n";
        }
      }
    }
    md += "---\n\n";
  }

  return textResponse(md, `conversations-${Date.now()}.md`, "text/markdown");
}

async function exportBulk(userId: string) {
  const [summaries, flashcards, graph, conversations] = await Promise.all([
    db
      .select({
        id: learningObjects.id,
        title: learningObjects.title,
        sourceType: learningObjects.sourceType,
        sourceUrl: learningObjects.sourceUrl,
        summaryTldr: learningObjects.summaryTldr,
        summaryKeyPoints: learningObjects.summaryKeyPoints,
        summaryDeep: learningObjects.summaryDeep,
        rawText: learningObjects.rawText,
        createdAt: learningObjects.createdAt,
      })
      .from(learningObjects)
      .where(eq(learningObjects.userId, userId)),
    db
      .select()
      .from(questions)
      .innerJoin(learningObjects, eq(questions.learningObjectId, learningObjects.id))
      .where(eq(learningObjects.userId, userId)),
    (async () => {
      const states = await db
        .select({
          conceptId: userConceptState.conceptId,
          mastery: userConceptState.masteryLevel,
          retrievability: userConceptState.fsrsRetrievability,
        })
        .from(userConceptState)
        .where(eq(userConceptState.userId, userId));

      const conceptIds = states.map((s) => s.conceptId);
      const conceptList =
        conceptIds.length > 0
          ? await db.select().from(concepts).where(inArray(concepts.id, conceptIds))
          : [];

      return { states, concepts: conceptList };
    })(),
    db.select().from(mentorConversations).where(eq(mentorConversations.userId, userId)),
  ]);

  const reviews = await db
    .select()
    .from(reviewLog)
    .where(eq(reviewLog.userId, userId))
    .orderBy(desc(reviewLog.createdAt));

  const exportData = {
    exportedAt: new Date().toISOString(),
    learningObjects: summaries.map((s) => ({
      ...s,
      summaryKeyPoints: safeParseJSON(s.summaryKeyPoints),
      rawText: s.rawText ? "[included]" : null,
    })),
    flashcards: flashcards.map((f) => f.questions),
    knowledgeGraph: graph,
    conversations,
    reviewHistory: reviews,
  };

  return jsonResponse(exportData, `learngraph-export-${Date.now()}.json`);
}

// ─── Helpers ───

function jsonResponse(data: unknown, filename: string) {
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function textResponse(content: string, filename: string, contentType: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function safeParseJSON(str: string | null): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function sanitizeTSV(str: string): string {
  return str.replace(/[\t\n\r]/g, " ").trim();
}

function csvEscape(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
