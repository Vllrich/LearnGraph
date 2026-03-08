export default function OfflinePage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center text-center px-6">
      <div className="mb-4 text-4xl">📡</div>
      <h1 className="text-lg font-medium">You&apos;re offline</h1>
      <p className="mt-1 text-[13px] text-muted-foreground/60">
        Check your internet connection and try again.
      </p>
    </div>
  );
}
