"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ContentData } from "./types";

export function DocSearchBar({ data }: { data: ContentData }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const contentEl = document.querySelector<HTMLElement>("[data-doc-content]");
    if (!contentEl) return;

    contentEl.querySelectorAll("mark[data-doc-search]").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
      parent.normalize();
    });

    if (query.length < 2) return;

    const lowerQuery = query.toLowerCase();
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    let firstMark: HTMLElement | null = null;
    for (const node of textNodes) {
      const text = node.textContent ?? "";
      const lowerText = text.toLowerCase();
      let idx = lowerText.indexOf(lowerQuery);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let last = 0;
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.setAttribute("data-doc-search", "");
        mark.style.cssText = "background:hsl(48 96% 53%/0.4);color:inherit;border-radius:2px;";
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        if (!firstMark) firstMark = mark;
        last = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }

    firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [query]);

  const matchCount = (() => {
    if (query.length < 2) return 0;
    const fullText = data.chunks
      .map((c) => c.content)
      .join(" ")
      .toLowerCase();
    const q = query.toLowerCase();
    let count = 0,
      pos = 0;
    let idx = fullText.indexOf(q, pos);
    while (idx !== -1) {
      count++;
      pos = idx + q.length;
      idx = fullText.indexOf(q, pos);
    }
    return count;
  })();

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/20 px-4">
      <Search className="size-3 text-muted-foreground/40" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search in document..."
        className="flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground/30 focus:outline-none"
      />
      {query.length >= 2 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/40">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
      )}
    </div>
  );
}
