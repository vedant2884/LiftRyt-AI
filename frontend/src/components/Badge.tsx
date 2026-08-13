import type { ReactNode } from "react";

type BadgeVariant = "beta" | "success" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const BASE_CLASS = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";

/** Small status pill. "beta" gets a purple->emerald gradient ring (the
 * brand-gradient signature) via the standard double-background border
 * trick — a solid inner fill (padding-box) layered under the gradient
 * (border-box) so only the 1px edge shows the gradient. */
export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  if (variant === "beta") {
    return (
      <span
        className={`${BASE_CLASS} border border-transparent text-brand-purple ${className}`}
        style={{
          backgroundImage: "linear-gradient(var(--surface), var(--surface)), var(--gradient-brand)",
          backgroundOrigin: "padding-box, border-box",
          backgroundClip: "padding-box, border-box",
        }}
      >
        {children}
      </span>
    );
  }

  const variantClass = variant === "success" ? "bg-success/10 text-success" : "bg-surface-hover text-ink-secondary";
  return <span className={`${BASE_CLASS} ${variantClass} ${className}`}>{children}</span>;
}
