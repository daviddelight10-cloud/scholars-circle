export function TabSkeleton({ variant = "default" }) {
  const pulse = "animate-pulse";

  if (variant === "cards") {
    return (
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
        <div className={`mb-6 h-8 w-48 rounded-lg bg-hub-border ${pulse}`} />
        <div className="mb-4 flex gap-2">
          <div className={`h-9 w-28 rounded-full bg-hub-border ${pulse}`} />
          <div className={`h-9 w-28 rounded-full bg-hub-border ${pulse}`} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`rounded-xl border border-hub-border bg-hub-surface p-4 ${pulse}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-lg bg-hub-bg" />
                <div className="flex-1">
                  <div className="mb-1.5 h-3.5 w-3/4 rounded bg-hub-bg" />
                  <div className="h-2.5 w-1/2 rounded bg-hub-bg" />
                </div>
              </div>
              <div className="mb-2 flex gap-1.5">
                <div className="h-4 w-12 rounded bg-hub-bg" />
                <div className="h-4 w-12 rounded bg-hub-bg" />
              </div>
              <div className="h-3 w-full rounded bg-hub-bg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "chat") {
    return (
      <div className="flex h-full flex-col p-4">
        <div className={`mb-4 h-10 w-full rounded-xl bg-hub-border ${pulse}`} />
        <div className="flex-1 space-y-3">
          <div className={`max-w-[60%] rounded-2xl bg-hub-border ${pulse}`}>
            <div className="h-4 w-48 p-3" />
          </div>
          <div className={`ml-auto max-w-[60%] rounded-2xl bg-hub-border ${pulse}`}>
            <div className="h-4 w-32 p-3" />
          </div>
          <div className={`max-w-[60%] rounded-2xl bg-hub-border ${pulse}`}>
            <div className="h-4 w-56 p-3" />
          </div>
        </div>
        <div className={`mt-4 h-12 w-full rounded-xl bg-hub-border ${pulse}`} />
      </div>
    );
  }

  if (variant === "analytics") {
    return (
      <div className="mx-auto max-w-[1000px] p-4 sm:p-6">
        <div className={`mb-6 h-8 w-40 rounded-lg bg-hub-border ${pulse}`} />
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-24 rounded-xl border border-hub-border bg-hub-surface p-4 ${pulse}`}>
              <div className="mb-2 h-3 w-16 rounded bg-hub-bg" />
              <div className="h-6 w-20 rounded bg-hub-bg" />
            </div>
          ))}
        </div>
        <div className={`h-64 rounded-xl border border-hub-border bg-hub-surface ${pulse}`} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] p-4 sm:p-6">
      <div className={`mb-6 h-8 w-48 rounded-lg bg-hub-border ${pulse}`} />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`h-16 rounded-xl border border-hub-border bg-hub-surface ${pulse}`} style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default TabSkeleton;
