import { useToastStore } from "../store/toastStore";

const VARIANT_CLASS: Record<string, string> = {
  success: "border-success/30 bg-success/10 text-success",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-line-strong bg-surface text-ink",
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{ animation: "toast-slide-in 0.2s ease-out" }}
          className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${VARIANT_CLASS[t.variant]}`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-xs opacity-70 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
