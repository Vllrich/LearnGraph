import OfficeParser from "officeparser";

export type DocxResult = {
  text: string;
  title: string | null;
};

export async function extractDocxText(buffer: Buffer): Promise<DocxResult> {
  const text = await OfficeParser.parseOfficeAsync(buffer, {
    outputErrorToConsole: false,
  });

  const normalized = normalizeText(text);
  const title = extractFirstHeading(normalized);

  return { text: normalized, title };
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
