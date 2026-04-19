"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { GitBranch, Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

// `mermaid.render` attaches a transient <svg id=...> to the DOM while laying
// out, so we need a DOM-safe, collision-free id per instance. Using React's
// `useId()` alone isn't enough because it contains ":" which is not a valid
// CSS selector start character; we sanitize it here.
function useMermaidId() {
  const rawId = useId();
  return `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramId = useMermaidId();
  const { resolvedTheme } = useTheme();

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;

        // Re-initializing on every (chart, theme) change is safe and is the
        // supported way to switch themes at runtime. `startOnLoad: false`
        // prevents mermaid from scanning the DOM for `.mermaid` elements on
        // its own — we drive rendering explicitly via `render()`.
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "dark" ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: "inherit",
        });

        // Validate first so we can show a readable fallback instead of
        // mermaid's in-SVG error card, which looks broken in a lesson flow.
        await mermaid.parse(chart);

        const { svg: rendered, bindFunctions } = await mermaid.render(
          diagramId,
          chart,
        );

        if (cancelled) return;
        setError(null);
        setSvg(rendered);

        // Give mermaid one microtask to commit the SVG to the DOM before
        // wiring up click-through handlers (e.g. for clickable nodes).
        queueMicrotask(() => {
          if (cancelled || !containerRef.current) return;
          bindFunctions?.(containerRef.current);
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Invalid diagram syntax.";
        setSvg(null);
        setError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, resolvedTheme, diagramId]);

  function handleCopy() {
    navigator.clipboard.writeText(chart.trim());
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "group relative my-4 overflow-hidden rounded-lg border border-border/40",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-4 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/60">
          <GitBranch className="size-3" />
          Diagram
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
          aria-label="Copy diagram source"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="relative px-4 py-4">
        {!svg && !error && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground/40" />
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground">
              Couldn&apos;t render this diagram. Showing the source instead.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted/40 px-3 py-2 text-[12px] leading-[1.6]">
              <code className="font-mono text-foreground/80">
                {chart.trim()}
              </code>
            </pre>
          </div>
        )}

        {svg && (
          <div
            ref={containerRef}
            className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );
}
