"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useTextSelection, type SelectionSnapshot } from "./use-text-selection";
import {
  SELECTION_ACTIONS,
  type SelectionAction,
  type SelectionContext,
} from "./actions";
import { SelectionToolbar } from "./selection-toolbar";

type SelectionAssistantProps = {
  /** The learning-goal id that owns this lesson (for ownership checks). */
  goalId: string;
  /** The lesson currently being rendered. */
  lessonId: string;
  /** The lesson block currently visible, if any — makes explanations sharper. */
  blockId?: string;
  lessonTitle?: string;
  /**
   * Short hint about what the current block is teaching (e.g. the concept
   * name). Sent to the LLM to keep explanations on-topic.
   */
  blockTopic?: string;
  /**
   * Optional override of the action set. Defaults to `SELECTION_ACTIONS`.
   * The toolbar + result sheet will adapt automatically.
   */
  actions?: SelectionAction[];
  /** The selectable content. The hook only tracks selections inside this tree. */
  children: React.ReactNode;
};

/**
 * Drop-in wrapper around a block of lesson content. Renders:
 *   - a selection-aware floating toolbar (portaled to body)
 *   - a responsive result sheet that hosts panel-style action renderers
 *
 * Panel surfaces are rendered from the action's own `surface.render(ctx)`
 * function, so adding a new action is a single registry edit (no central
 * switch statement in this file). Inline-kind actions fire their handler
 * and do not open the sheet.
 */
export function SelectionAssistant({
  goalId,
  lessonId,
  blockId,
  lessonTitle,
  blockTopic,
  actions = SELECTION_ACTIONS,
  children,
}: SelectionAssistantProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Sheet state. While the sheet is open, we pause selection tracking so that
  // a stray selection inside the sheet's own content doesn't re-anchor the
  // toolbar under it.
  const [active, setActive] = useState<{
    actionId: string;
    snapshot: SelectionSnapshot;
  } | null>(null);

  const { selection, clear } = useTextSelection(containerRef, {
    enabled: !active,
  });

  const availableActions = useMemo(() => {
    if (!selection) return actions;
    const ctx: SelectionContext = {
      selection,
      goalId,
      lessonId,
      blockId,
      lessonTitle,
      blockTopic,
    };
    return actions.filter((a) => (a.isAvailable ? a.isAvailable(ctx) : true));
  }, [actions, selection, goalId, lessonId, blockId, lessonTitle, blockTopic]);

  const onAction = useCallback(
    (actionId: string) => {
      if (!selection) return;
      const action = actions.find((a) => a.id === actionId);
      if (!action) return;

      const ctx: SelectionContext = {
        selection,
        goalId,
        lessonId,
        blockId,
        lessonTitle,
        blockTopic,
      };

      if (action.surface.kind === "inline") {
        // Fire-and-forget. Inline actions are responsible for their own UI
        // feedback (toasts, navigation, etc.). We still clear the selection
        // so the toolbar dismisses like the user expects.
        void action.surface.handler(ctx);
        clear();
        return;
      }

      setActive({ actionId, snapshot: selection });
    },
    [actions, selection, goalId, lessonId, blockId, lessonTitle, blockTopic, clear],
  );

  const activeAction = active
    ? actions.find((a) => a.id === active.actionId)
    : null;

  const activeCtx: SelectionContext | null = active
    ? {
        selection: active.snapshot,
        goalId,
        lessonId,
        blockId,
        lessonTitle,
        blockTopic,
      }
    : null;

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      setActive(null);
      clear();
    }
  };

  const activePanelSurface =
    activeAction && activeAction.surface.kind === "panel"
      ? activeAction.surface
      : null;

  return (
    <>
      <div ref={containerRef} data-selection-root>
        {children}
      </div>

      <SelectionToolbar
        selection={active ? null : selection}
        actions={availableActions}
        onAction={onAction}
      />

      <Sheet open={!!active && !!activePanelSurface} onOpenChange={handleSheetOpenChange}>
        <SheetContent>
          {activePanelSurface && activeCtx && (
            <>
              <SheetHeader>
                <SheetTitle>{activePanelSurface.title}</SheetTitle>
                {activePanelSurface.subtitle && (
                  <SheetDescription>{activePanelSurface.subtitle}</SheetDescription>
                )}
              </SheetHeader>
              <SheetBody>
                {/* Keying by snapshot text + lesson forces a fresh mount on
                    a new selection, so panels stay free of reset-via-effect
                    logic (React 19 friendly). */}
                <PanelContainer
                  key={`${activeCtx.lessonId}:${activeCtx.selection.text}`}
                >
                  {activePanelSurface.render(activeCtx)}
                </PanelContainer>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Tiny boundary that gives us a stable remount target for panel renderers
 * keyed by the active selection. Kept as a dedicated component so the
 * `key` change remounts only the panel subtree, not the sheet chrome.
 */
function PanelContainer({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
