import React, { useState, useEffect } from "react";
import { toast } from "./Toast";
import { api } from "../lib/appUtils";
import { SUBJECTS } from "../data";

export function StudyReminders({ reminders, setReminders, timetable, notificationPermission, setNotificationPermission, token }) {
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newReminderLabel, setNewReminderLabel] = useState("");
  const [newReminderSubject, setNewReminderSubject] = useState("");

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission().then((perm) => setNotificationPermission(perm));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach((r) => {
        if (!r.sent && new Date(r.time) <= now) {
          if (notificationPermission === "granted") {
            new Notification("📚 Study Reminder", { body: r.label, icon: "/loading.png" });
          }
          setReminders((prev) => prev.map((rem) => rem.id === r.id ? { ...rem, sent: true } : rem));
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [reminders, notificationPermission, setReminders]);

  function addReminder() {
    if (!newReminderTime || !newReminderLabel) {
      toast.warning("Please enter both time and label");
      return;
    }
    const reminder = {
      id: Date.now(),
      time: newReminderTime,
      label: newReminderLabel,
      subject: newReminderSubject,
      sent: false,
    };
    setReminders([...reminders, reminder]);
    if (token) {
      api("/user-data/reminders", { token, method: "POST", body: reminder }).catch(console.error);
    }
    setNewReminderTime("");
    setNewReminderLabel("");
    setNewReminderSubject("");
  }

  function deleteReminder(id) {
    setReminders(reminders.filter((r) => r.id !== id));
    if (token) {
      api(`/user-data/reminders/${id}`, { token, method: "DELETE" }).catch(console.error);
    }
  }

  function requestPermission() {
    if ("Notification" in window) {
      Notification.requestPermission().then((perm) => setNotificationPermission(perm));
    }
  }

  const timetableReminders = Object.entries(timetable).flatMap(([day, slots]) =>
    Object.entries(slots).map(([hour, subject]) => ({
      label: `Study ${subject} from Timetable`,
      subject,
      day,
      hour: parseInt(hour),
    }))
  );

  return (
    <div className="card">
      <div className="row">
        <h2>Study Reminders</h2>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted">Notifications: {notificationPermission}</span>
          {notificationPermission !== "granted" && <button onClick={requestPermission}>Enable</button>}
        </div>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input type="datetime-local" value={newReminderTime} onChange={(e) => setNewReminderTime(e.target.value)} />
        <input
          placeholder="Label (e.g., 'Review BIO111')"
          value={newReminderLabel}
          onChange={(e) => setNewReminderLabel(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={newReminderSubject} onChange={(e) => setNewReminderSubject(e.target.value)}>
          <option value="">No Subject</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
        </select>
        <button onClick={addReminder} style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}>+ Add</button>
      </div>
      {timetableReminders.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Timetable Suggestions</h4>
          <p className="muted" style={{ fontSize: 13 }}>Click to add reminder for scheduled study time:</p>
          <div className="history">
            {timetableReminders.slice(0, 15).map((r, i) => {
              const [hours, minutes] = r.hour.toString().padStart(2, '0').match(/.{1,2}/g) || ['00', '00'];
              const nextOccurrence = new Date();
              nextOccurrence.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              if (nextOccurrence <= new Date()) nextOccurrence.setDate(nextOccurrence.getDate() + 1);
              return (
                <div key={i} className="history-row">
                  <span>{r.day} {hours}:{minutes} — {r.label}</span>
                  <button style={{ fontSize: 12 }} onClick={() => {
                    setNewReminderTime(nextOccurrence.toISOString().slice(0, 16));
                    setNewReminderLabel(r.label);
                    setNewReminderSubject(r.subject);
                  }}>Add Reminder</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <h4 style={{ marginTop: 20 }}>Your Reminders ({reminders.length})</h4>
      {reminders.length === 0 && <p className="muted">No reminders set yet.</p>}
      <div className="history">
        {reminders.sort((a, b) => new Date(a.time) - new Date(b.time)).map((r) => {
          const isPast = new Date(r.time) < new Date();
          return (
            <div key={r.id} className="history-row" style={{ opacity: r.sent ? 0.5 : 1 }}>
              <span>
                {r.sent ? "✅" : isPast ? "⏰" : "📅"} {r.label} — {new Date(r.time).toLocaleString()}
                {r.subject && <span className="muted"> ({r.subject})</span>}
              </span>
              <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => deleteReminder(r.id)}>Delete</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
