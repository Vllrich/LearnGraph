import { extractText, getMeta } from "unpdf";
import { PDFParse } from "pdf-parse";

export type PdfResult = {
  text: string;
  pageCount: number;
  title: string | null;
  pageOffsets: Map<number, number>;
};

const MIN_USEFUL_TEXT = 100;

export async function extractPdfText(buffer: Buffer): Promise<PdfResult> {
  const uint8 = new Uint8Array(buffer);

  const { text: rawText, totalPages } = await extractText(uint8, {
    mergePages: false,
  });

  const pages = Array.isArray(rawText) ? rawText : [rawText];
  const pageOffsets = new Map<number, number>();
  let offset = 0;

  for (let i = 0; i < pages.length; i++) {
    pageOffsets.set(offset, i + 1);
    offset += (pages[i]?.length ?? 0) + 2;
  }

  let fullText = pages.join("\n\n");

  // Fallback: if unpdf returned too little text (font-handling issues), try pdf-parse
  if (normalizeText(fullText).length < MIN_USEFUL_TEXT) {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      if (result.text && normalizeText(result.text).length > normalizeText(fullText).length) {
        fullText = result.text;
      }
      await parser.destroy();
    } catch {
      // keep whatever unpdf returned
    }
  }

  let title: string | null = null;
  try {
    const meta = await getMeta(uint8);
    title = meta?.info?.Title ?? null;
  } catch {
    // metadata extraction optional
  }

  if (!title) {
    title = extractFirstHeading(fullText);
  }

  const text = normalizeText(fullText);

  return {
    text,
    pageCount: totalPages ?? pages.length,
    title,
    pageOffsets,
  };
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractFirstHeading(text: string): string | null {
  const lines = text.split("\n").slice(0, 20);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 200) {
      return trimmed;
    }
  }
  return null;
}
