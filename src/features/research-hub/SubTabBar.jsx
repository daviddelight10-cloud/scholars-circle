import { sharedStyles } from "./constants";

export default function SubTabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div style={sharedStyles.subTabRow}>
      {tabs.map(([key, label, count]) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          style={activeTab === key ? sharedStyles.subTabActive : sharedStyles.subTab}
        >
          {label}
          {count != null && count > 0 && (
            <span style={sharedStyles.tabCount}>{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
