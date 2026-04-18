export function LoadingSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-11 items-center gap-2 border-b border-border/30 px-3">
        <div className="size-4 rounded bg-muted/50 animate-pulse" />
        <div className="h-3.5 w-48 rounded bg-muted/50 animate-pulse" />
      </div>
      <div className="flex flex-1">
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="h-4 w-4/5 rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
            <div className="h-px bg-border/20 my-4" />
            <div className="h-4 w-2/3 rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
          </div>
        </div>
        <div className="w-px bg-border/30" />
        <div className="w-[520px] p-4">
          <div className="flex gap-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3.5 w-14 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
