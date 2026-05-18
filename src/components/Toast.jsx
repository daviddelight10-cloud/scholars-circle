import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Global toast ref so it can be called from anywhere without hooks
let globalToastFn = null;

export const toast = {
  success: (msg, dur) => globalToastFn?.("success", msg, dur),
  error: (msg, dur) => globalToastFn?.("error", msg, dur),
  info: (msg, dur) => globalToastFn?.("info", msg, dur),
  warning: (msg, dur) => globalToastFn?.("warning", msg, dur),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register the global function
  useEffect(() => {
    globalToastFn = (type, msg, dur) => addToast(msg, type, dur);
    return () => { globalToastFn = null; };
  }, [addToast]);

  const toastHook = useCallback((message, type, duration) => addToast(message, type, duration), [addToast]);
  toastHook.success = (msg, dur) => addToast(msg, "success", dur);
  toastHook.error = (msg, dur) => addToast(msg, "error", dur);
  toastHook.info = (msg, dur) => addToast(msg, "info", dur);
  toastHook.warning = (msg, dur) => addToast(msg, "warning", dur);

  return (
    <ToastContext.Provider value={toastHook}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 99999,
      display: "flex",
      flexDirection: "column-reverse",
      gap: 10,
      maxWidth: "min(380px, calc(100vw - 40px))",
      pointerEvents: "none",
    }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

const ICONS = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const COLORS = {
  success: { bg: "rgba(16, 185, 129, 0.95)", border: "#34d399" },
  error: { bg: "rgba(239, 68, 68, 0.95)", border: "#f87171" },
  info: { bg: "rgba(99, 102, 241, 0.95)", border: "#a5b4fc" },
  warning: { bg: "rgba(245, 158, 11, 0.95)", border: "#fbbf24" },
};

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const colors = COLORS[toast.type] || COLORS.info;

  return (
    <div
      onClick={() => { setExiting(true); setTimeout(onDismiss, 300); }}
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: "#fff",
        fontSize: 13,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
        cursor: "pointer",
        pointerEvents: "auto",
        animation: exiting ? "toastSlideOut 0.3s ease forwards" : "toastSlideIn 0.3s ease",
        lineHeight: 1.4,
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: "50%",
        background: "rgba(255,255,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>
        {ICONS[toast.type]}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  );
}

// CSS for animations - inject once
const styleId = "toast-animations";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes toastSlideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes toastSlideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(120%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
