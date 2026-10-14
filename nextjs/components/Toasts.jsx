"use client";

const icons = { info: "i", success: "✓", error: "!" };

export default function Toasts({ toasts, closeLabel, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
          <span className="toast-icon" aria-hidden="true">
            {icons[toast.tone] || icons.info}
          </span>
          <p>{toast.message}</p>
          <button type="button" className="toast-close" title={closeLabel} aria-label={closeLabel} onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
