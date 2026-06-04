import { useToastStore, type Toast } from "../stores/toastStore";
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
