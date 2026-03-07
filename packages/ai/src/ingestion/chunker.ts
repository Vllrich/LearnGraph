import { Tiktoken, encodingForModel } from "js-tiktoken";
import { CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS } from "@repo/shared";

let _enc: Tiktoken | null = null;
function getEncoder(): Tiktoken {
  if (!_enc) _enc = encodingForModel("gpt-4o-mini");
  return _enc;
}

export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

export type Chunk = {
  content: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  chunkIndex: number;
  tokenCount: number;
};

const SECTION_HEADER_RE =
  /^(?:#{1,6}\s.+|(?:[A-Z][A-Za-z0-9 ,&:–-]{2,80})\s*$)/m;

/**
 * Semantic chunking: split on headers → paragraphs → sentences,
 * with ~CHUNK_OVERLAP_TOKENS overlap between adjacent chunks.
 */
export function semanticChunk(
  text: string,
  opts: { pageNumbers?: Map<number, number> } = {},
): Chunk[] {
  const maxTokens = CHUNK_MAX_TOKENS;
  const overlapTokens = CHUNK_OVERLAP_TOKENS;
  const sections = splitOnHeaders(text);
  const rawChunks: { content: string; sectionTitle: string | null }[] = [];

  for (const section of sections) {
    const sectionChunks = splitSection(section.body, maxTokens);
    for (const c of sectionChunks) {
      rawChunks.push({ content: c, sectionTitle: section.title });
    }
  }

  const chunks: Chunk[] = [];
  let overlapPrefix = "";

  for (let i = 0; i < rawChunks.length; i++) {
    const raw = rawChunks[i];
    let withOverlap =
      i > 0 && overlapPrefix ? overlapPrefix + " " + raw.content : raw.content;

    if (countTokens(withOverlap) > maxTokens && i > 0) {
      withOverlap = raw.content;
    }

    const tokenCount = countTokens(withOverlap);

    chunks.push({
      content: withOverlap,
      sectionTitle: raw.sectionTitle,
      pageNumber: resolvePageNumber(raw.content, text, opts.pageNumbers ?? null),
      chunkIndex: i,
      tokenCount,
    });

    const words = raw.content.split(/\s+/);
    const overlapWords: string[] = [];
    let overlapToks = 0;
    for (let w = words.length - 1; w >= 0 && overlapToks < overlapTokens; w--) {
      overlapWords.unshift(words[w]);
      overlapToks = countTokens(overlapWords.join(" "));
    }
    overlapPrefix = overlapWords.join(" ");
  }

  return chunks;
}

type Section = { title: string | null; body: string };

function splitOnHeaders(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentTitle: string | null = null;
  let buffer: string[] = [];

  for (const line of lines) {
    if (SECTION_HEADER_RE.test(line.trim()) && buffer.length > 0) {
      sections.push({ title: currentTitle, body: buffer.join("\n").trim() });
      currentTitle = line.trim().replace(/^#+\s*/, "");
      buffer = [];
    } else if (SECTION_HEADER_RE.test(line.trim()) && buffer.length === 0) {
      currentTitle = line.trim().replace(/^#+\s*/, "");
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    sections.push({ title: currentTitle, body: buffer.join("\n").trim() });
  }

  return sections.filter((s) => s.body.length > 0);
}

function splitSection(text: string, maxTokens: number): string[] {
  if (countTokens(text) <= maxTokens) return [text];

  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length > 1) {
    return mergeSplits(paragraphs, maxTokens);
  }

  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) ?? [text];
  return mergeSplits(sentences, maxTokens);
}

function mergeSplits(parts: string[], maxTokens: number): string[] {
  const results: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate = current ? current + "\n\n" + part.trim() : part.trim();
    if (countTokens(candidate) > maxTokens && current) {
      results.push(current.trim());
      current = part.trim();
    } else {
      current = candidate;
    }
  }

  if (current.trim()) results.push(current.trim());
  return results;
}

function resolvePageNumber(
  chunkText: string,
  fullText: string,
  pageMap: Map<number, number> | null,
): number | null {
  if (!pageMap || pageMap.size === 0) return null;
  const offset = fullText.indexOf(chunkText);
  if (offset === -1) return null;

  let page = 1;
  for (const [charOffset, pageNum] of pageMap) {
    if (charOffset <= offset) page = pageNum;
    else break;
  }
  return page;
}
