import { extractText, getMeta } from "unpdf";
import { generateText, type CoreMessage } from "ai";
import { primaryModel } from "../models";

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

  // Fallback: if pdfjs can't handle the fonts, use the LLM to read the PDF directly
  if (normalizeText(fullText).length < MIN_USEFUL_TEXT) {
    try {
      const llmText = await extractTextViaLLM(buffer);
      if (llmText && normalizeText(llmText).length > normalizeText(fullText).length) {
        fullText = llmText;
      }
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

async function extractTextViaLLM(buffer: Buffer): Promise<string> {
  const messages: CoreMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Extract ALL text content from this PDF document verbatim. Preserve paragraph structure with blank lines between paragraphs. Do not summarize — output the full text exactly as written. If the document contains tables, render them as plain text. Output ONLY the document text, no commentary.",
        },
        {
          type: "file",
          data: buffer,
          mimeType: "application/pdf",
        },
      ],
    },
  ];

  const { text } = await generateText({
    model: primaryModel,
    messages,
    maxTokens: 16000,
  });

  return text;
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
