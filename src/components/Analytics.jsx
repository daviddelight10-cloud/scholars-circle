import { percent } from "../utils";

export default function Analytics({ history }) {
  if (history.length === 0) {
    return (
      <div className="card">
        <h2>Analytics</h2>
        <p className="muted">No sessions yet. Start studying to see stats.</p>
      </div>
    );
  }

  const avg = Math.round(
    history.reduce((acc, h) => acc + percent(h.score, h.total), 0) / history.length
  );

  return (
    <div className="card">
      <h2>Analytics</h2>
      <p className="muted">Average score: {avg}%</p>
      <div className="history">
        {history
          .slice()
          .reverse()
          .map((h, i) => (
            <div key={`${h.subjectId}-${i}`} className="history-row">
              <span>{h.subjectLabel}</span>
              <strong>
                {h.score}/{h.total} ({percent(h.score, h.total)}%)
              </strong>
            </div>
          ))}
      </div>
    </div>
  );
}
