"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A stable snapshot of the current non-collapsed text selection, scoped to a
 * container. Everything the toolbar / downstream panels need to render is
 * captured once when selection stabilizes so that later scroll/resize events
 * can't mutate the anchor underneath us.
 */
export type SelectionSnapshot = {
  /** Trimmed selected text. Never empty. */
  text: string;
  /** Viewport-space rect of the selection's bounding range, at selection-time. */
  rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  /** Up to ~400 characters of surrounding text from the closest block-level ancestor, for LLM grounding. */
  surroundingText: string;
};

type UseTextSelectionOptions = {
  /** When false, the hook stops tracking. Use to pause detection (e.g. while a sheet is open). */
  enabled?: boolean;
  /** Milliseconds to wait after the last selection event before capturing. */
  debounceMs?: number;
  /** Minimum trimmed length of selection text to surface. */
  minLength?: number;
  /** Maximum characters to keep as surrounding context. */
  contextChars?: number;
};

const FORM_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isInsideFormField(node: Node | null): boolean {
  let el: Node | null = node;
  while (el) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const tag = (el as Element).tagName;
      if (FORM_INPUT_TAGS.has(tag)) return true;
      if ((el as HTMLElement).isContentEditable) return true;
    }
    el = el.parentNode;
  }
  return false;
}

/** Walks up from `node` until it finds a block-level element (or the root). */
function findBlockAncestor(node: Node | null, root: HTMLElement): HTMLElement {
  let el: Node | null = node;
  while (el && el !== root) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const display = window.getComputedStyle(el as Element).display;
      if (display.startsWith("block") || display === "flex" || display === "grid" || display === "list-item") {
        return el as HTMLElement;
      }
    }
    el = el.parentNode;
  }
  return root;
}

function captureSurroundingText(
  range: Range,
  selected: string,
  root: HTMLElement,
  maxChars: number,
): string {
  const block = findBlockAncestor(range.startContainer, root);
  // `textContent` avoids the layout/reflow that `innerText` triggers on
  // long blocks. We collapse runs of whitespace afterwards so the result
  // is close to what the reader sees.
  const fullText = (block.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!fullText) return selected;

  if (fullText.length <= maxChars) return fullText;

  const idx = fullText.indexOf(selected);
  if (idx < 0) return fullText.slice(0, maxChars);

  const half = Math.floor((maxChars - selected.length) / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(fullText.length, idx + selected.length + half);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < fullText.length ? "…" : "";
  return prefix + fullText.slice(start, end) + suffix;
}

/**
 * Tracks the user's text selection inside a container and exposes a stable
 * snapshot suitable for anchoring a floating toolbar.
 *
 * Design notes:
 * - We debounce `selectionchange` so that the toolbar doesn't flicker during
 *   an active drag. The capture happens once the user pauses.
 * - Selections inside form inputs and contentEditable regions are ignored so
 *   we don't hijack answer textareas.
 * - Scrolling inside the container hides the toolbar (until the user re-
 *   selects) to avoid the bar drifting off-anchor.
 */
export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseTextSelectionOptions = {},
) {
  const {
    enabled = true,
    debounceMs = 180,
    minLength = 1,
    contextChars = 400,
  } = options;

  const [snapshot, setSnapshot] = useState<SelectionSnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnapshot(null);
    const sel = window.getSelection();
    sel?.removeAllRanges();
  }, []);

  useEffect(() => {
    // When disabled we simply stop observing. The consumer is responsible
    // for hiding any floating UI tied to the snapshot (typically by
    // calling `clear()`), so we don't reset state here — that would run
    // afoul of React 19's `set-state-in-effect` rule and isn't needed for
    // correctness in this hook's intended usage.
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    const capture = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSnapshot(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      if (text.length < minLength) {
        setSnapshot(null);
        return;
      }
      // Selection must start AND end inside our root — not bleed into the
      // surrounding chrome — and must not live in a form field.
      if (
        !root.contains(range.startContainer) ||
        !root.contains(range.endContainer) ||
        isInsideFormField(range.startContainer) ||
        isInsideFormField(range.endContainer)
      ) {
        setSnapshot(null);
        return;
      }
      const clientRect = range.getBoundingClientRect();
      // Empty rect can happen transiently during layout — bail and wait.
      if (clientRect.width === 0 && clientRect.height === 0) {
        setSnapshot(null);
        return;
      }
      const surroundingText = captureSurroundingText(range, text, root, contextChars);
      setSnapshot({
        text,
        rect: {
          top: clientRect.top,
          left: clientRect.left,
          right: clientRect.right,
          bottom: clientRect.bottom,
          width: clientRect.width,
          height: clientRect.height,
        },
        surroundingText,
      });
    };

    const onSelectionChange = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(capture, debounceMs);
    };

    // Hiding on scroll keeps the toolbar from drifting off-anchor. The user
    // can re-select to bring it back. Capturing `true` in case a scrollable
    // ancestor (not window) is what actually moves the range.
    const onScroll = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSnapshot((prev) => (prev ? null : prev));
    };

    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onScroll);
    };
  }, [containerRef, enabled, debounceMs, minLength, contextChars]);

  return { selection: snapshot, clear };
}
