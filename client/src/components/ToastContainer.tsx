import { useToastStore, type Toast } from "../stores/toastStore";
import { useEffect } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

const ICONS = {
  success: <CheckCircle size={14} className="text-[var(--color-success)]" />,
  error: <AlertCircle size={14} className="text-[var(--color-danger)]" />,
  warning: <AlertTriangle size={14} className="text-[var(--color-warning)]" />,
  info: <Info size={14} className="text-[var(--color-accent)]" />,
};

const BORDERS = {
  success: "border-[var(--color-success)]",
  error: "border-[var(--color-danger)]",
  warning: "border-[var(--color-warning)]",
  info: "border-[var(--color-accent)]",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  // Dismiss latest toast on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const latest = useToastStore.getState().toasts[useToastStore.getState().toasts.length - 1];
        if (latest) removeToast(latest.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-1.5 pointer-events-none">
      {toasts.map((toast: Toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-[var(--color-bg3)] text-xs text-[var(--color-t1)] shadow-lg pointer-events-auto animate-[slideUp_0.3s_ease] ${BORDERS[toast.type]}`}
        >
          {ICONS[toast.type]}
          <span className="flex-1 max-w-[300px] truncate">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { toast.action!.onClick(); removeToast(toast.id); }}
              className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-[10px] font-medium flex-shrink-0 px-1"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => removeToast(toast.id)}
            className="text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
