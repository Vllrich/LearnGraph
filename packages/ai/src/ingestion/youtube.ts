export type YoutubeResult = {
  text: string;
  title: string;
  duration: number | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  videoId: string;
};

const VIDEO_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractVideoId(url: string): string | null {
  const match = url.match(VIDEO_ID_RE);
  return match ? match[1] : null;
}

/**
 * Fetches YouTube transcript via the public innertube API.
 * No API key needed for auto-generated captions.
 */
export async function fetchYoutubeTranscript(
  url: string,
): Promise<YoutubeResult> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error(`Invalid YouTube URL: ${url}`);

  const pageHtml = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  }).then((r) => r.text());

  const title = extractTitle(pageHtml);
  const channelName = extractChannelName(pageHtml);
  const duration = extractDuration(pageHtml);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const captionUrl = extractCaptionUrl(pageHtml);
  if (!captionUrl) {
    throw new Error(
      "No captions available for this video. Only videos with captions are supported.",
    );
  }

  const captionXml = await fetch(captionUrl).then((r) => r.text());
  const text = parseCaptionXml(captionXml);

  if (text.length < 50) {
    throw new Error("Transcript too short — captions may be empty or broken.");
  }

  return { text, title, duration, channelName, thumbnailUrl, videoId };
}

function extractTitle(html: string): string {
  const match = html.match(/<title>(.+?)<\/title>/);
  return match
    ? match[1].replace(/ - YouTube$/, "").trim()
    : "Untitled Video";
}

function extractChannelName(html: string): string | null {
  const match = html.match(/"ownerChannelName":"([^"]+)"/);
  return match ? match[1] : null;
}

function extractDuration(html: string): number | null {
  const match = html.match(/"lengthSeconds":"(\d+)"/);
  return match ? parseInt(match[1], 10) : null;
}

function extractCaptionUrl(html: string): string | null {
  const match = html.match(
    /"captionTracks":\[.*?"baseUrl":"(.*?)"/,
  );
  if (!match) return null;
  return match[1].replace(/\\u0026/g, "&");
}

function parseCaptionXml(xml: string): string {
  const textSegments: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml))) {
    const decoded = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .trim();
    if (decoded) textSegments.push(decoded);
  }
  return textSegments.join(" ");
}
