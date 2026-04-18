import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";
import type { useMentorChat } from "@/hooks/use-mentor-chat";
import {
  MessageSquare,
  Layers,
  CircleHelp,
  AlignLeft,
  Lightbulb,
  GitFork,
  type LucideIcon,
} from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type ContentData = NonNullable<RouterOutput["library"]["getById"]>;

export type SelectionActionType =
  | "explain"
  | "chat"
  | "quiz"
  | "flashcard"
  | "copy"
  | "read";

export type MentorChatHandlers = ReturnType<typeof useMentorChat>;

export const PANEL_TABS: Array<{ id: PanelTab; icon: LucideIcon; label: string }> = [
  { id: "Chat", icon: MessageSquare, label: "Chat" },
  { id: "Flashcards", icon: Layers, label: "Flashcards" },
  { id: "Quizzes", icon: CircleHelp, label: "Quiz" },
  { id: "Summary", icon: AlignLeft, label: "Summary" },
  { id: "Concepts", icon: Lightbulb, label: "Concepts" },
  { id: "Related", icon: GitFork, label: "Related" },
];

export type PanelTab = "Chat" | "Flashcards" | "Quizzes" | "Summary" | "Concepts" | "Related";
