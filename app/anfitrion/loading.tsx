export default function AnfitrionLoading() {
  return (
    <main className="min-w-0 flex-1 pb-8">
      <div className="animate-pulse space-y-6 pt-2">
        <div className="h-9 w-56 max-w-full rounded-lg bg-card-muted" />
        <div className="h-36 w-full rounded-2xl bg-card-muted ring-1 ring-[var(--ring-soft)]" />
        <div className="h-24 w-full rounded-xl bg-card-muted/70" />
      </div>
    </main>
  );
}
