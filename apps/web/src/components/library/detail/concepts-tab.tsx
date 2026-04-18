import type { ContentData } from "./types";

export function ConceptsTab({ data }: { data: ContentData }) {
  if (data.concepts.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-muted-foreground/50">
        No concepts extracted yet.
      </p>
    );
  }

  return (
    <div className="px-4 py-4 space-y-1.5">
      {data.concepts.map((c) => (
        <div key={c.id} className="rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foreground/85">{c.displayName}</span>
            {c.difficultyLevel != null && (
              <span className="text-[10px] text-muted-foreground/40">L{c.difficultyLevel}</span>
            )}
          </div>
          {c.definition && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/60">
              {c.definition}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
