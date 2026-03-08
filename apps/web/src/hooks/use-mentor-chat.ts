"use client";

import { useState, useCallback, useRef } from "react";

type Citation = {
  chunkId: string;
  content: string;
  pageNumber: number | null;
  learningObjectId?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
};

type SSEEvent =
  | { type: "citations"; citations: Citation[] }
  | { type: "text"; text: string }
  | { type: "done"; conversationId: string }
  | { type: "error"; error: string };

export function useMentorChat(learningObjectId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = { role: "user", content };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      const historyForApi = messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.citations ? { citations: m.citations } : {}),
      }));

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/mentor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            learningObjectId,
            message: content,
            history: historyForApi,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Failed to connect to mentor");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentCitations: Citation[] | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const dataLine = line.replace(/^data: /, "").trim();
            if (!dataLine) continue;

            let event: SSEEvent;
            try {
              event = JSON.parse(dataLine);
            } catch {
              continue;
            }

            if (event.type === "citations") {
              currentCitations = event.citations;
            } else if (event.type === "text") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + event.text,
                    citations: currentCitations,
                  };
                }
                return updated;
              });
            } else if (event.type === "done") {
              setConversationId(event.conversationId);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    isStreaming: false,
                  };
                }
                return updated;
              });
            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: `Error: ${event.error}`,
                    isStreaming: false,
                  };
                }
                return updated;
              });
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: "Sorry, something went wrong. Please try again.",
                isStreaming: false,
              };
            }
            return updated;
          });
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading, conversationId, learningObjectId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const loadConversation = useCallback((msgs: ChatMessage[], convId: string) => {
    setMessages(msgs);
    setConversationId(convId);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    stop,
    loadConversation,
  };
}
