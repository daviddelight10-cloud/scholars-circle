export default function EmptyState({ icon = "📭", title, message, action, size = "md" }) {
  const iconSize = size === "lg" ? "text-6xl mb-6" : "text-4xl mb-2";
  const titleClass = size === "lg"
    ? "mb-2 text-xl font-extrabold text-hub-text-muted"
    : "mb-1 text-sm font-bold text-hub-text-muted";

  return (
    <div className="px-5 py-16 text-center">
      <div className={iconSize}>{icon}</div>
      {title && <div className={titleClass}>{title}</div>}
      {message && (
        <div className="mx-auto max-w-md text-[13px] leading-relaxed text-hub-text-dim">{message}</div>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
