import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export type AudioResult = {
  text: string;
  title: string | null;
  durationSeconds: number | null;
};

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // Whisper API limit

/**
 * Transcribe audio using OpenAI Whisper API.
 * Supports mp3, mp4, wav, m4a, webm.
 */
export async function transcribeAudio(buffer: Buffer, fileName: string): Promise<AudioResult> {
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(
      `Audio file too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum is 25MB.`
    );
  }

  const file = new File([buffer], fileName, {
    type: getMimeType(fileName),
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("language", "en");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`Whisper transcription failed: ${err}`);
  }

  const data = (await res.json()) as {
    text: string;
    duration?: number;
  };

  const title = await generateTitle(data.text.slice(0, 2000));

  return {
    text: data.text,
    title,
    durationSeconds: data.duration ?? null,
  };
}

async function generateTitle(textSample: string): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: openai("gpt-4.1-mini"),
      prompt: `Generate a short, descriptive title (max 10 words) for this audio transcription. Return ONLY the title, nothing else.\n\n${textSample}`,
      maxTokens: 30,
    });
    return text.trim().replace(/^["']|["']$/g, "") || null;
  } catch {
    return null;
  }
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  return mimeMap[ext ?? ""] ?? "audio/mpeg";
}
