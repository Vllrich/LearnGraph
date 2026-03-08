import OfficeParser from "officeparser";

export type PptxResult = {
  text: string;
  title: string | null;
  slideCount: number;
};

export async function extractPptxText(buffer: Buffer): Promise<PptxResult> {
  const text = await OfficeParser.parseOfficeAsync(buffer, {
    outputErrorToConsole: false,
    putBulletsInRows: true,
    newlineDelimiter: "\n",
  });

  const normalized = normalizeText(text);
  const slides = normalized.split(/\n{2,}/).filter((s) => s.trim().length > 0);
  const title = extractFirstHeading(normalized);

  return {
    text: normalized,
    title,
    slideCount: Math.max(slides.length, 1),
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
  const lines = text.split("\n").slice(0, 10);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 200) {
      return trimmed;
    }
  }
  return null;
}
