"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, MessageSquare, CircleHelp, Layers, Copy, Volume2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectionActionType } from "./types";

const SELECTION_ACTIONS: Array<{
  id: SelectionActionType;
  icon: LucideIcon;
  label: string;
  color: string;
}> = [
  { id: "explain", icon: Sparkles, label: "Explain", color: "text-amber-500" },
  { id: "chat", icon: MessageSquare, label: "Chat", color: "text-blue-500" },
  { id: "quiz", icon: CircleHelp, label: "Quiz", color: "text-violet-500" },
  { id: "flashcard", icon: Layers, label: "Flashcards", color: "text-emerald-500" },
  { id: "copy", icon: Copy, label: "Copy", color: "text-muted-foreground" },
  { id: "read", icon: Volume2, label: "Read aloud", color: "text-rose-400" },
];

export function SelectionMenu({
  position,
  onAction,
  onClose,
}: {
  position: { top: number; left: number };
  onAction: (action: SelectionActionType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedLeft, setAdjustedLeft] = useState(position.left);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const menuWidth = ref.current.offsetWidth;
    const halfMenu = menuWidth / 2;
    const clamped = Math.max(
      halfMenu + 8,
      Math.min(position.left, window.innerWidth - halfMenu - 8)
    );
    setAdjustedLeft(clamped);
    requestAnimationFrame(() => setVisible(true));
  }, [position.left]);

  const above = position.top > 64;

  return (
    <div
      ref={ref}
      style={{
        top: above ? position.top - 48 : position.top + 12,
        left: adjustedLeft,
        transform: "translateX(-50%)",
      }}
      className={cn(
        "pointer-events-auto fixed z-50 flex items-center gap-0.5 rounded-xl border border-border/40 bg-popover px-1 py-0.5 shadow-2xl shadow-black/15 ring-1 ring-black/3 backdrop-blur-xl transition-all duration-150",
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      )}
    >
      {SELECTION_ACTIONS.map(({ id, icon: Icon, label, color }) => (
        <button
          key={id}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => {
            onAction(id);
            onClose();
          }}
          className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground/70 transition-all hover:bg-accent hover:text-foreground"
        >
          <Icon className={cn("size-3.5 shrink-0 transition-colors group-hover:scale-110", color)} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
