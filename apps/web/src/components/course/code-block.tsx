"use client";

import { useEffect, useState, useRef } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "python",
        "java",
        "c",
        "cpp",
        "csharp",
        "go",
        "rust",
        "html",
        "css",
        "json",
        "bash",
        "sql",
        "markdown",
      ],
    });
  }
  return highlighterPromise;
}

type CodeBlockProps = {
  code: string;
  lang?: string;
  className?: string;
};

export function CodeBlock({ code, lang = "text", className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) return;
      const loadedLangs = hl.getLoadedLanguages();
      const resolvedLang = loadedLangs.includes(lang) ? lang : "text";
      const result = hl.codeToHtml(code.trim(), {
        lang: resolvedLang,
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
      });
      setHtml(result);
    });
    return () => { cancelled = true; };
  }, [code, lang]);

  function handleCopy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("group relative my-4 overflow-hidden rounded-lg border border-border/40", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-4 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground/60">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Code content */}
      {html ? (
        <div
          className="overflow-x-auto px-4 py-3 text-[13px] leading-[1.7] [&_pre]:bg-transparent! [&_code]:font-mono"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-[1.7]">
          <code className="font-mono text-foreground/80">{code.trim()}</code>
        </pre>
      )}
    </div>
  );
}
