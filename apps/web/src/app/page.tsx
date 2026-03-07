export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-primary" />
          <h1 className="text-display font-bold tracking-tight text-foreground">
            LearnGraph
          </h1>
        </div>
        <p className="max-w-md text-body-lg text-muted-foreground">
          Upload anything. Understand it once. Remember it forever.
        </p>
        <div className="flex gap-3">
          <span className="rounded-badge bg-brand-primary-subtle px-3 py-1 text-caption font-medium text-brand-primary">
            Phase 0 — Scaffolding
          </span>
        </div>
      </div>
    </div>
  );
}
