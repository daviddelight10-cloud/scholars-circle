export function CardSkeleton({ index = 0 }) {
  const delay = `${Math.min(index * 40, 400)}ms`;
  return (
    <div
      className="stagger-in animate-pulse rounded-xl border border-hub-border bg-hub-surface p-4"
      style={{ borderLeftWidth: "3px", borderLeftColor: "#2a2a2a", animationDelay: delay }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-lg bg-hub-bg" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 h-3.5 w-3/4 rounded bg-hub-bg" />
          <div className="h-2.5 w-1/2 rounded bg-hub-bg" />
        </div>
      </div>
      <div className="mb-2 h-2 w-full rounded-full bg-hub-bg" />
      <div className="flex gap-1.5">
        <div className="h-4 w-10 rounded bg-hub-bg" />
        <div className="h-4 w-10 rounded bg-hub-bg" />
      </div>
    </div>
  );
}

export default function LoadingState({ label = "Loading…", grid = false, count = 4 }) {
  if (grid) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} index={i} />)}
      </div>
    );
  }

  return (
    <div className="px-5 py-16 text-center">
      <div className="mb-2 text-4xl">⏳</div>
      <div className="text-sm font-bold text-hub-text-muted">{label}</div>
    </div>
  );
}
