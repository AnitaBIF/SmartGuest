export default function AdminLoading() {
  return (
    <main className="min-w-0 flex-1 pb-8">
      <div className="animate-pulse space-y-6 pt-2">
        <div className="ml-auto h-9 w-48 max-w-full rounded-lg bg-card-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 rounded-2xl bg-card-muted" />
          <div className="h-24 rounded-2xl bg-card-muted" />
        </div>
        <div className="h-64 w-full rounded-2xl bg-card-muted ring-1 ring-[var(--ring-soft)]" />
      </div>
    </main>
  );
}
