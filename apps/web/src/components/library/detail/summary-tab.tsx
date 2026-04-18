import type { ContentData } from "./types";

export function SummaryTab({ data }: { data: ContentData }) {
  let keyPoints: string[] = [];
  if (data.summaryKeyPoints) {
    try {
      keyPoints = JSON.parse(data.summaryKeyPoints);
      if (!Array.isArray(keyPoints)) keyPoints = [];
    } catch {
      keyPoints = [];
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {data.summaryTldr && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            TL;DR
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/85">{data.summaryTldr}</p>
        </div>
      )}
      {keyPoints.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Key Points
          </p>
          <ul className="space-y-1.5">
            {keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-foreground/75">
                <span className="mt-[6px] size-1 shrink-0 rounded-full bg-green-500/60" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.summaryDeep && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Full Summary
          </p>
          <div className="space-y-2 text-[12px] leading-relaxed text-foreground/70">
            {data.summaryDeep.split("\n\n").map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
      {!data.summaryTldr && !data.summaryDeep && (
        <p className="py-8 text-center text-[12px] text-muted-foreground/50">
          No summary available.
        </p>
      )}
    </div>
  );
}
