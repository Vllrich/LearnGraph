"use client";

import React, { useMemo, useRef } from "react";
import { Tooltip } from "@/components/ui/tooltip-card";
import { CodeBlock } from "@/components/course/code-block";
import { MusicScore } from "@/components/course/music-score";
import { MermaidDiagram } from "@/components/course/mermaid-diagram";
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
    //
    // While streaming, we defer emitting the block until the closing fence
    // has arrived. Rendering a partial block on every chunk caused expensive
    // children (MermaidDiagram, MusicScore) to mount with ever-growing input
    // and kick off a new async render per chunk — dozens of concurrent
    // `mermaid.render()` / `abcjs.renderAbc()` calls piling up on the main
    // thread. That stacked work caused the renderer to hang on subsequent
    // interactions (e.g. clicking the Continue button right after reading a
    // block containing a diagram). By skipping unclosed fences entirely, the
    // diagram/score mounts exactly once with its final content when the last
    // chunk (containing the closing ```) lands.
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim() || "text";
      const codeLines: string[] = [];
      i++;
      let closed = false;
      while (i < lines.length) {
        if (/^```\s*$/.test(lines[i]!)) {
          closed = true;
          i++;
          break;
        }
        codeLines.push(lines[i]!);
        i++;
      }
      if (closed) {
        blocks.push({ type: "code_block", lang, code: codeLines.join("\n") });
      } else {
        // Stream hasn't delivered the closing fence yet. Bail out entirely
        // — the next parse (triggered by the next chunk) will re-evaluate
        // once the full block is in hand. Everything already pushed to
        // `blocks` (prose before the fence) is fine to keep.
        break;
      }
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

export const MarkdownContent = React.memo(function MarkdownContent({
  text,
  className,
}: MarkdownContentProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  // Reveal-animation bookkeeping. We track the previous block count in a ref
  // rather than state so we don't trigger a second render per chunk (the
  // earlier `setPrevText` during-render pattern forced React to discard and
  // re-run the whole parse on every streaming tick, compounding with heavy
  // children like MermaidDiagram). The ref is updated during render which is
  // safe here because the read happens strictly BEFORE the write and the
  // stored value is used as a visual hint only — missing an animation frame
  // is strictly preferable to blocking the main thread.
  const prevBlockCountRef = useRef(0);
  const newFromIndex = prevBlockCountRef.current;
  prevBlockCountRef.current = blocks.length;

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
                ) : block.lang === "mermaid" ? (
                  <MermaidDiagram chart={block.code} />
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
});
