export default function ErrorState({ message, onRetry }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mb-2 text-4xl">⚠️</div>
      <div className="text-sm font-bold text-hub-text-muted">Something went wrong</div>
      {message && (
        <div className="mx-auto mb-4 max-w-md text-[13px] leading-relaxed text-hub-text-dim">{message}</div>
      )}
      {onRetry && (
        <button onClick={onRetry} className="cursor-pointer rounded-full border border-gold-border bg-gold-dim px-4 py-1.5 text-[11px] font-semibold text-gold transition-all active:scale-95">
          ↻ Retry
        </button>
      )}
    </div>
  );
}
