import type { ComponentType, SVGProps } from "react";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  message: string;
  actionLabel: string;
  onAction?: () => void;
  to?: string;
  className?: string;
}

/** Icon + one-line message + a real button (not just a link), for "there's
 * genuinely no data yet" states. Pass either `to` (navigates) or `onAction`
 * (runs a handler, e.g. focuses a form) depending on what makes sense. */
export function EmptyState({ icon: Icon, message, actionLabel, onAction, to, className = "" }: EmptyStateProps) {
  const buttonClass =
    "inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97]";

  return (
    <div className={`flex flex-col items-center gap-3 py-8 text-center ${className}`}>
      <Icon className="h-8 w-8 text-ink-muted" />
      <p className="text-sm text-ink-secondary">{message}</p>
      {to ? (
        <Link to={to} className={buttonClass}>
          {actionLabel}
        </Link>
      ) : (
        <button type="button" onClick={onAction} className={buttonClass}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
