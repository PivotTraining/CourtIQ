"use client";

import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "error", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const error = useCallback((msg) => show(msg, "error"), [show]);
  const success = useCallback((msg) => show(msg, "success"), [show]);
  const info = useCallback((msg) => show(msg, "info"), [show]);

  return (
    <ToastContext.Provider value={{ show, error, success, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 w-[calc(100%-48px)] max-w-[400px] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-fade-in-up rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3"
            style={{
              background: t.type === "error" ? "#FEF2F2" : t.type === "success" ? "#F0FDF4" : "#EFF6FF",
              border: `1px solid ${t.type === "error" ? "#FECACA" : t.type === "success" ? "#BBF7D0" : "#BFDBFE"}`,
            }}
          >
            <span className="text-lg flex-shrink-0">
              {t.type === "error" ? "⚠️" : t.type === "success" ? "✅" : "💡"}
            </span>
            <span
              className="text-sm font-semibold"
              style={{
                color: t.type === "error" ? "#991B1B" : t.type === "success" ? "#166534" : "#1E40AF",
              }}
            >
              {t.message}
            </span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-auto text-lg opacity-40 hover:opacity-80 bg-transparent border-none cursor-pointer flex-shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
