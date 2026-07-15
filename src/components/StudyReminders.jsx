import React, { useState, useEffect, useRef } from "react";
import { toast } from "./Toast";
import { api } from "../lib/appUtils";
import { SUBJECTS } from "../data";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseHourLabel(hourLabel) {
  const match = hourLabel.match(/^(\d+)(am|pm)$/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const meridiem = match[2].toLowerCase();
  if (meridiem === "pm" && h !== 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return h;
}

function getNextOccurrence(dayName, hourInt) {
  const now = new Date();
  const targetDay = DAY_NAMES.indexOf(dayName);
  if (targetDay === -1) return null;
  const result = new Date(now);
  result.setHours(hourInt, 0, 0, 0);
  let diff = (targetDay - now.getDay() + 7) % 7;
  if (diff === 0 && result <= now) diff = 7;
  result.setDate(result.getDate() + diff);
  return result;
}

export function StudyReminders({ reminders, setReminders, timetable, notificationPermission, setNotificationPermission, token }) {
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newReminderLabel, setNewReminderLabel] = useState("");
  const [newReminderSubject, setNewReminderSubject] = useState("");
  const autoReminderKeysRef = useRef(new Set());

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

  const timetableReminders = Object.entries(timetable).map(([slotKey, cell]) => {
    const parts = slotKey.split("-");
    const day = parts[0];
    const hourLabel = parts.slice(1).join("-");
    const hourInt = parseHourLabel(hourLabel);
    if (hourInt === null || !cell) return null;
    return {
      key: slotKey,
      label: `Study ${cell.subject}`,
      subject: cell.subject,
      day,
      hour: hourInt,
      hourLabel,
    };
  }).filter(Boolean);

  useEffect(() => {
    if (!timetable || Object.keys(timetable).length === 0) return;
    const newSlots = [];
    Object.entries(timetable).forEach(([slotKey, cell]) => {
      if (!cell || autoReminderKeysRef.current.has(slotKey)) return;
      const parts = slotKey.split("-");
      const day = parts[0];
      const hourLabel = parts.slice(1).join("-");
      const hourInt = parseHourLabel(hourLabel);
      if (hourInt === null) return;
      const next = getNextOccurrence(day, hourInt);
      if (!next) return;
      const existing = reminders.find(r => r.timetableKey === slotKey && !r.sent);
      if (existing) return;
      newSlots.push({
        id: Date.now() + Math.random(),
        time: next.toISOString().slice(0, 16),
        label: `Study ${cell.subject}`,
        subject: cell.subject,
        sent: false,
        timetableKey: slotKey,
      });
      autoReminderKeysRef.current.add(slotKey);
    });
    if (newSlots.length > 0) {
      setReminders(prev => [...prev, ...newSlots]);
      toast.success(`Auto-reminder${newSlots.length > 1 ? "s" : ""} created from timetable`);
    }
  }, [timetable, reminders, setReminders]);

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
        <button onClick={addReminder} style={{ borderColor: "#FFD700", color: "#FFD700" }}>+ Add</button>
      </div>
      {timetableReminders.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>From Your Timetable</h4>
          <p className="muted" style={{ fontSize: 13 }}>Click to set a custom reminder time for these slots:</p>
          <div className="history">
            {timetableReminders.slice(0, 15).map((r, i) => {
              const nextOccurrence = getNextOccurrence(r.day, r.hour);
              return (
                <div key={i} className="history-row">
                  <span>{r.day} {r.hourLabel} — {r.label}</span>
                  <button style={{ fontSize: 12 }} onClick={() => {
                    if (nextOccurrence) {
                      setNewReminderTime(nextOccurrence.toISOString().slice(0, 16));
                      setNewReminderLabel(r.label);
                      setNewReminderSubject(r.subject);
                    }
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
