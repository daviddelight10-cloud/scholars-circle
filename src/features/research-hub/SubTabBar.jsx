export default function SubTabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="sc-tabrow mb-4 flex w-full gap-2 overflow-x-auto border-b border-hub-border">
      {tabs.map(([key, label, count]) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-2 py-2 text-[13px] font-semibold transition-colors duration-150 ${
            activeTab === key
              ? "border-gold font-bold text-gold"
              : "border-transparent text-hub-text-dim hover:text-hub-text-muted"
          }`}
        >
          {label}
          {count != null && count > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === key ? "bg-gold-dim text-gold" : "bg-hub-border text-hub-text-dim"
            }`}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
