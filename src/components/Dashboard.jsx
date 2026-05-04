export default function Dashboard({ subjects, stats, onStart }) {
  return (
    <div className="card">
      <h2>Dashboard</h2>
      <p className="muted">
        XP: <strong>{stats.xp}</strong> | Sessions: <strong>{stats.sessions}</strong>
      </p>
      <div className="subjects">
        {subjects.map((s) => (
          <button key={s.id} className="subject-btn" onClick={() => onStart(s.id)}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
