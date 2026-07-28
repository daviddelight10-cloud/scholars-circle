export default function Settings({ darkMode, onToggleDark, onReset }) {
  return (
    <div className="card">
      <h2>Settings</h2>
      <div className="row">
        <span>Theme</span>
        <button onClick={onToggleDark}>{darkMode ? "Dark" : "Light"}</button>
      </div>
      <div className="row">
        <span>Progress</span>
        <button className="danger" onClick={onReset}>
          Reset data
        </button>
      </div>
    </div>
  );
}
