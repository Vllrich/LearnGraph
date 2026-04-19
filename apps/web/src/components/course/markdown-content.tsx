"use client";

import React, { useState, useMemo } from "react";
import { Tooltip } from "@/components/ui/tooltip-card";
import { CodeBlock } from "@/components/course/code-block";
import { MusicScore } from "@/components/course/music-score";
import { cn } from "@/lib/utils";

// ── Inline AST ─────────────────────────────────────────────────────────────

type InlineNode =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string };

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      nodes.push({ type: "bold", content: match[1] });
    } else if (match[2] !== undefined) {
      nodes.push({ type: "italic", content: match[2] });
    } else if (match[3] !== undefined) {
      nodes.push({ type: "code", content: match[3] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", content: text.slice(lastIndex) });
  }

  return nodes;
}

// ── Block AST ──────────────────────────────────────────────────────────────

type Block =
  | { type: "h2"; nodes: InlineNode[] }
  | { type: "h3"; nodes: InlineNode[] }
  | { type: "ul"; items: InlineNode[][] }
  | { type: "ol"; items: InlineNode[][] }
  | { type: "p"; nodes: InlineNode[] }
  | { type: "code_block"; lang: string; code: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code blocks: ```lang ... ```
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) {
        codeLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: "code_block", lang, code: codeLines.join("\n") });
    } else if (/^## /.test(line)) {
      blocks.push({ type: "h2", nodes: parseInline(line.replace(/^## /, "")) });
      i++;
    } else if (/^### /.test(line)) {
      blocks.push({ type: "h3", nodes: parseInline(line.replace(/^### /, "")) });
      i++;
    } else if (/^- /.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^- /.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(/^- /, "")));
        i++;
      }
      blocks.push({ type: "ul", items });
    } else if (/^\d+\. /.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(/^\d+\. /, "")));
        i++;
      }
      blocks.push({ type: "ol", items });
    } else if (line.trim() === "") {
      i++;
    } else {
      // Gather contiguous non-empty, non-special lines → single paragraph
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim() !== "" &&
        !/^#{1,3} /.test(lines[i]!) &&
        !/^- /.test(lines[i]!) &&
        !/^\d+\. /.test(lines[i]!) &&
        !/^```/.test(lines[i]!)
      ) {
        paraLines.push(lines[i]!);
        i++;
      }
      if (paraLines.length > 0) {
        blocks.push({ type: "p", nodes: parseInline(paraLines.join(" ")) });
      }
    }
  }

  return blocks;
}

// ── Inline renderer ────────────────────────────────────────────────────────

function RenderInline({ nodes, keyPrefix }: { nodes: InlineNode[]; keyPrefix: string }) {
  return (
    <>
      {nodes.map((node, i) => {
        const key = `${keyPrefix}-${i}`;
        switch (node.type) {
          case "bold":
            return (
              <Tooltip
                key={key}
                content={
                  <div>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Key Concept
                    </div>
                    <div className="font-semibold text-foreground">{node.content}</div>
                  </div>
                }
              >
                <strong className="cursor-help border-b border-dotted border-primary/40 font-semibold text-foreground transition-colors hover:border-primary/70 hover:text-primary">
                  {node.content}
                </strong>
              </Tooltip>
            );
          case "italic":
            return <em key={key}>{node.content}</em>;
          case "code":
            return (
              <code
                key={key}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground/90"
              >
                {node.content}
              </code>
            );
          default:
            return <React.Fragment key={key}>{node.content}</React.Fragment>;
        }
      })}
    </>
  );
}

// ── Public component ───────────────────────────────────────────────────────

type MarkdownContentProps = {
  text: string;
  className?: string;
};

export function MarkdownContent({ text, className }: MarkdownContentProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  // Track previous text so we can derive which blocks are new.
  // When text grows, blocks added after the previous parse count get the
  // reveal animation. On first render everything animates in.
  const [prevText, setPrevText] = useState(text);
  const prevBlocks = useMemo(() => parseBlocks(prevText), [prevText]);
  let newFromIndex = prevBlocks.length;
  if (text !== prevText) {
    setPrevText(text);
  } else {
    newFromIndex = blocks.length;
  }

  return (
    <div
      className={cn(
        "font-(family-name:--font-source-serif) text-[1.05rem] leading-[1.85]",
        className,
      )}
    >
      {blocks.map((block, i) => {
        const isNew = i >= newFromIndex;
        const anim = isNew ? "animate-reveal-up" : undefined;
        const key = `${block.type}-${i}`;

        switch (block.type) {
          case "h2":
            return (
              <h2 key={key} className={cn("mt-8 mb-3 font-sans text-xl font-semibold tracking-tight", anim)}>
                <RenderInline nodes={block.nodes} keyPrefix={key} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={key} className={cn("mt-6 mb-2 font-sans text-base font-semibold tracking-tight", anim)}>
                <RenderInline nodes={block.nodes} keyPrefix={key} />
              </h3>
            );
          case "ul":
            return (
              <ul key={key} className={cn("my-3 ml-5 list-disc space-y-1.5 marker:text-muted-foreground/50", anim)}>
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1 leading-[1.75]">
                    <RenderInline nodes={item} keyPrefix={`${key}-${j}`} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className={cn("my-3 ml-5 list-decimal space-y-1.5 marker:text-muted-foreground/50", anim)}>
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1 leading-[1.75]">
                    <RenderInline nodes={item} keyPrefix={`${key}-${j}`} />
                  </li>
                ))}
              </ol>
            );
          case "code_block":
            return (
              <div key={key} className={anim}>
                {block.lang === "abc" ? (
                  <MusicScore abc={block.code} />
                ) : (
                  <CodeBlock code={block.code} lang={block.lang} />
                )}
              </div>
            );
          default:
            return (
              <p key={key} className={cn("mb-4 leading-[1.85]", anim)}>
                <RenderInline nodes={block.nodes} keyPrefix={key} />
              </p>
            );
        }
      })}
    </div>
  );
}
