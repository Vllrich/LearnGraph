import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, MessageCircle } from "lucide-react";

import type { SelectionSnapshot } from "./use-text-selection";
import { ExplainPanel } from "./explain-panel";
import { AskMentorPanel } from "./ask-mentor-panel";

/** Context attached to every selection action invocation. */
export type SelectionContext = {
  selection: SelectionSnapshot;
  lessonId: string;
  goalId: string;
  blockId?: string;
  lessonTitle?: string;
  /**
   * Human-readable hint about what the current lesson block is teaching.
   * Used to make explanations lesson-aware instead of generic.
   */
  blockTopic?: string;
};

/**
 * Describes what opens when a selection action fires.
 *
 *   - `{ kind: "panel", render }` — mounts `render(ctx)` inside the result
 *     sheet. The orchestrator keys the render by `lessonId:selection.text`
 *     so panel components stay free of reset-via-effect logic.
 *   - `{ kind: "inline", handler }` — self-contained side effect; no sheet
 *     opens. Use for "Hear it" (Web Speech API), "Copy",
 *     "Link to graph" (navigation), etc.
 */
export type SelectionSurface =
  | {
      kind: "panel";
      title: string;
      subtitle?: string;
      render: (ctx: SelectionContext) => ReactNode;
    }
  | {
      kind: "inline";
      handler: (ctx: SelectionContext) => void | Promise<void>;
    };

export type SelectionAction = {
  id: string;
  label: string;
  /** Optional shorter label for narrow toolbars. */
  shortLabel?: string;
  icon: LucideIcon;
  /** The surface this action opens (a panel) or runs (inline). */
  surface: SelectionSurface;
  /**
   * Enablement predicate. Return false to hide the action for this selection
   * (e.g. "Hear it" might require a max length; "Save" might require auth).
   */
  isAvailable?: (ctx: SelectionContext) => boolean;
};

/**
 * V1 action registry. Order is display order in the floating toolbar.
 *
 * Adding a new action is a single edit here:
 *
 *   1. Panel-style action (opens the sheet):
 *
 *        {
 *          id: "translate",
 *          label: "Translate",
 *          icon: Languages,
 *          surface: {
 *            kind: "panel",
 *            title: "Translation",
 *            subtitle: "Into your preferred language.",
 *            render: (ctx) => <TranslatePanel ctx={ctx} />,
 *          },
 *        }
 *
 *   2. Inline action (self-contained, no sheet):
 *
 *        {
 *          id: "hear_it",
 *          label: "Hear it",
 *          icon: Volume2,
 *          surface: {
 *            kind: "inline",
 *            handler: (ctx) => speakWithWebSpeech(ctx.selection.text),
 *          },
 *        }
 *
 * If the new action needs a server round-trip, drop a route under
 * `apps/web/src/app/api/learn/<action>/route.ts` mirroring the existing
 * `explain` / `ask` routes (auth + rate-limit + ownership join).
 *
 * Deferred for V1 (expansion path noted so future work is obvious):
 *   - `translate` (prompt variant of explain, target language from profile)
 *   - `simplify`  (prompt variant of explain, "explain like I'm 12")
 *   - `hear_it`   (Web Speech API on-device, inline surface)
 *   - `save`      (requires a `lesson_highlights` table + tRPC router)
 *   - `graph`     (concept match; inline surface that deep-links to /graph)
 */
export const SELECTION_ACTIONS: SelectionAction[] = [
  {
    id: "explain",
    label: "Explain",
    icon: BookOpen,
    surface: {
      kind: "panel",
      title: "Explanation",
      subtitle: "Contextual to your current lesson.",
      render: (ctx) => <ExplainPanel ctx={ctx} />,
    },
  },
  {
    id: "ask",
    label: "Ask mentor",
    shortLabel: "Ask",
    icon: MessageCircle,
    surface: {
      kind: "panel",
      title: "Ask about this",
      subtitle: "Your mentor has the surrounding context.",
      render: (ctx) => <AskMentorPanel ctx={ctx} />,
    },
  },
];
