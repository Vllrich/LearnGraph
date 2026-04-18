"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import type { MentorChatHandlers } from "./types";

export function PersistentChatInput({
  onFocusChat,
  mentorChat,
}: {
  learningObjectId: string;
  onFocusChat: () => void;
  mentorChat: MentorChatHandlers;
}) {
  const { isLoading, sendMessage, stop } = mentorChat;
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onFocusChat();
    sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage, onFocusChat]);

  return (
    <div className="border-t border-border/20 px-3 py-2.5">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={onFocusChat}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Learn anything"
          rows={1}
          disabled={isLoading}
          className="w-full resize-none rounded-xl border-0 bg-muted/30 px-3 py-2 pr-10 text-[13px] placeholder:text-muted-foreground/35 focus:bg-muted/40 focus:outline-none transition-colors"
          style={{ minHeight: "36px", maxHeight: "100px" }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "36px";
            t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
          }}
        />
        <div className="absolute bottom-1 right-1.5">
          {isLoading ? (
            <button
              onClick={stop}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted"
            >
              <Square className="size-3" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex size-6 items-center justify-center rounded-md bg-foreground text-background disabled:opacity-20 transition-opacity"
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
