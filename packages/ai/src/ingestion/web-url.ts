import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export type WebUrlResult = {
  text: string;
  title: string | null;
  siteName: string | null;
  url: string;
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5MB

const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "10.",
  "172.16.",
  "192.168.",
  "169.254.",
];

/**
 * Fetch a web URL and extract readable article text using Mozilla Readability.
 */
export async function extractWebUrl(url: string): Promise<WebUrlResult> {
  validateUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LearnGraphBot/1.0; +https://learngraph.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("URL does not point to an HTML page");
    }

    const html = await res.text();
    if (html.length > MAX_HTML_SIZE) {
      throw new Error("Page is too large to process");
    }

    return parseArticle(html, url);
  } finally {
    clearTimeout(timeout);
  }
}

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_DOMAINS.some((d) => hostname === d || hostname.startsWith(d))) {
    throw new Error("Private/local URLs are not allowed");
  }
}

function parseArticle(html: string, url: string): WebUrlResult {
  const { document } = parseHTML(html);

  const reader = new Readability(document as unknown as Document, {
    charThreshold: 100,
  });
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.trim().length < 100) {
    throw new Error("Could not extract meaningful content from this URL");
  }

  const text = normalizeText(article.textContent);

  return {
    text,
    title: article.title || null,
    siteName: article.siteName || null,
    url,
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
