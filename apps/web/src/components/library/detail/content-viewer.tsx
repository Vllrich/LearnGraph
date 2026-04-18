"use client";

import { useCallback, useState } from "react";
import { SelectionMenu } from "./selection-menu";
import type { ContentData, SelectionActionType } from "./types";

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function ContentViewer({
  data,
  onSelectionAction,
}: {
  data: ContentData;
  onSelectionAction: (action: SelectionActionType, text: string) => void;
}) {
  const [selectionMenu, setSelectionMenu] = useState<{
    text: string;
    position: { top: number; left: number };
  } | null>(null);

  const handlePointerUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (text.length < 2) {
        setSelectionMenu(null);
        return;
      }
      if (!sel || sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectionMenu({
        text,
        position: { top: rect.top, left: rect.left + rect.width / 2 },
      });
    }, 10);
  }, []);

  const handleAction = useCallback(
    (action: SelectionActionType) => {
      onSelectionAction(action, selectionMenu?.text ?? "");
    },
    [onSelectionAction, selectionMenu]
  );

  let keyPoints: string[] = [];
  if (data.summaryKeyPoints) {
    try {
      keyPoints = JSON.parse(data.summaryKeyPoints);
      if (!Array.isArray(keyPoints)) keyPoints = [];
    } catch {
      keyPoints = [];
    }
  }

  if (data.status !== "ready") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-muted-foreground/60">Content not yet available.</p>
      </div>
    );
  }

  const videoId =
    data.sourceType === "youtube" && data.sourceUrl ? extractVideoId(data.sourceUrl) : null;

  return (
    <div className="relative" data-doc-content onPointerUp={handlePointerUp}>
      {selectionMenu && (
        <SelectionMenu
          position={selectionMenu.position}
          onAction={handleAction}
          onClose={() => setSelectionMenu(null)}
        />
      )}
      <div className="mx-auto max-w-3xl px-8 py-8 font-serif">
        {videoId && (
          <div className="mb-6 aspect-video w-full overflow-hidden rounded-xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={data.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          </div>
        )}

        {data.summaryTldr && (
          <p className="mb-6 font-sans text-[15px] leading-relaxed text-foreground/80">
            {data.summaryTldr}
          </p>
        )}

        {keyPoints.length > 0 && (
          <div className="mb-8 border-l-2 border-primary/30 pl-4">
            {keyPoints.map((point, i) => (
              <p
                key={i}
                className="mb-1.5 font-sans text-[13px] leading-relaxed text-foreground/70"
              >
                • {point}
              </p>
            ))}
          </div>
        )}

        {data.summaryDeep && (
          <div className="mb-8 space-y-4 text-[15px] leading-[1.8] text-foreground/85">
            {data.summaryDeep.split("\n\n").map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {data.chunks.length > 0 && (
          <div className="space-y-8 border-t border-border/20 pt-8">
            {data.chunks.map((chunk) => (
              <div key={chunk.id}>
                {chunk.sectionTitle && (
                  <h3 className="mb-2 font-sans text-[14px] font-semibold text-primary/80">
                    {chunk.sectionTitle}
                  </h3>
                )}
                <p className="whitespace-pre-wrap text-[14px] leading-[1.75] text-foreground/75">
                  {chunk.content}
                </p>
                {chunk.pageNumber != null && (
                  <p className="mt-1.5 font-sans text-[11px] text-muted-foreground/40">
                    Page {chunk.pageNumber}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
