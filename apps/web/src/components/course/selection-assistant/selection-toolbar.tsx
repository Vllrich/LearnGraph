"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";
import type { SelectionAction } from "./actions";
import type { SelectionSnapshot } from "./use-text-selection";

type SelectionToolbarProps = {
  selection: SelectionSnapshot | null;
  actions: SelectionAction[];
  onAction: (actionId: string) => void;
};

type Placement = { top: number; left: number; origin: "top" | "bottom" };

const GAP = 10;
const TOOLBAR_HEIGHT = 36;

function computePlacement(
  rect: SelectionSnapshot["rect"],
  toolbarWidth: number,
  viewport: { width: number; height: number; coarse: boolean },
): Placement {
  // Horizontally center over the selection, clamp to viewport with a small pad.
  const pad = 8;
  let left = rect.left + rect.width / 2 - toolbarWidth / 2;
  left = Math.max(pad, Math.min(left, viewport.width - toolbarWidth - pad));

  // On coarse-pointer devices (iOS/Android) the native selection callout
  // (Copy/Lookup/Share) sits ABOVE the range by default. To avoid stacking
  // two floating UIs on top of each other, we prefer below-placement on
  // touch devices and only fall back above when there isn't room.
  const spaceAbove = rect.top;
  const spaceBelow = viewport.height - rect.bottom;
  const canGoAbove = spaceAbove >= TOOLBAR_HEIGHT + GAP;
  const canGoBelow = spaceBelow >= TOOLBAR_HEIGHT + GAP;

  const preferBelow = viewport.coarse;
  const placeBelow = preferBelow ? canGoBelow || !canGoAbove : !canGoAbove;

  if (placeBelow) {
    return { top: rect.bottom + GAP, left, origin: "top" };
  }
  return { top: rect.top - TOOLBAR_HEIGHT - GAP, left, origin: "bottom" };
}

/**
 * Resolve the visible viewport, preferring `window.visualViewport` when it's
 * available. That's the box the user actually sees — on iOS Safari this
 * excludes the keyboard and follows the URL-bar collapse/expand, which the
 * plain `window.innerWidth`/`innerHeight` pair lies about.
 */
function getVisibleViewport(): { width: number; height: number; coarse: boolean } {
  const vv = window.visualViewport;
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    coarse,
  };
}

// Subscribes to nothing; acts as a hydration-safe gate that flips to `true`
// on the client only after hydration completes. Preferred over the
// `useState + useEffect(setTrue)` pattern under React 19's effect rules.
const noopSubscribe = () => () => {};
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function SelectionToolbar({
  selection,
  actions,
  onAction,
}: SelectionToolbarProps) {
  const hydrated = useIsHydrated();
  const [placement, setPlacement] = useState<Placement | null>(null);

  // Callback ref: measures the toolbar the moment React attaches it to the
  // DOM and on every selection change (because the ref is recreated by the
  // new closure). setState here runs in a ref callback, not an effect body,
  // so React 19's set-state-in-effect rule is satisfied by construction.
  const measureRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !selection) return;
      const toolbarWidth = node.offsetWidth || 180;
      setPlacement(
        computePlacement(selection.rect, toolbarWidth, getVisibleViewport()),
      );
    },
    [selection],
  );

  if (!hydrated) return null;

  return createPortal(
    <AnimatePresence>
      {selection && placement && (
        <motion.div
          ref={measureRef}
          key="selection-toolbar"
          role="toolbar"
          aria-label="Selection actions"
          initial={{ opacity: 0, y: placement.origin === "bottom" ? 4 : -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: placement.origin === "bottom" ? 4 : -4, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.6 }}
          style={{ top: placement.top, left: placement.left }}
          // Swallow pointerdown so the selection isn't collapsed before our
          // click handler fires. Without this, tapping the bar on some
          // mobile browsers will clear the selection first.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "fixed z-50 flex items-center gap-0.5 rounded-full border border-border/50 bg-popover/95 px-1 py-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md",
            "dark:ring-white/5",
          )}
        >
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.id)}
                title={action.label}
                className={cn(
                  "group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-foreground/80 transition-colors",
                  "hover:bg-muted hover:text-foreground focus:bg-muted focus:outline-none",
                  i > 0 && "ml-0",
                )}
              >
                <Icon className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                <span className="hidden sm:inline">{action.label}</span>
                <span className="sm:hidden">{action.shortLabel ?? action.label}</span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
