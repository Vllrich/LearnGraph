import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export type ImageResult = {
  text: string;
  title: string | null;
};

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Extract text content from an image using GPT-4o vision.
 * Handles diagrams, handwritten notes, slides, and documents.
 */
export async function extractImageContent(buffer: Buffer, fileName: string): Promise<ImageResult> {
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(
      `Image too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum is 20MB.`
    );
  }

  const mimeType = getImageMimeType(fileName);
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const { text } = await generateText({
    model: openai("gpt-4o"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: dataUrl,
          },
          {
            type: "text",
            text: `You are an expert content extractor. Analyze this image and extract ALL text content, including:
- Any printed or handwritten text (full OCR)
- Descriptions of diagrams, charts, or figures
- Mathematical formulas (in LaTeX notation)
- Table data (as markdown tables)
- Slide content (preserving structure)

Format the output as clean, structured text. Preserve headings and hierarchy.
If the image contains educational content, organize it clearly for studying.
Return ONLY the extracted content, no commentary.`,
          },
        ],
      },
    ],
    maxOutputTokens: 4096,
  });

  const trimmed = text.trim();
  if (trimmed.length < 20) {
    throw new Error("Could not extract meaningful content from this image");
  }

  const title = extractTitle(trimmed);

  return { text: trimmed, title };
}

function extractTitle(text: string): string | null {
  const firstLine = text.split("\n")[0]?.trim();
  if (firstLine && firstLine.length > 3 && firstLine.length < 200) {
    return firstLine.replace(/^#+\s*/, "");
  }
  return null;
}

function getImageMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  return mimeMap[ext ?? ""] ?? "image/png";
}
