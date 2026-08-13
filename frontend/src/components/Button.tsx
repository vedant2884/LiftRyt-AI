import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE_CLASS = "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-accent px-4 py-2 text-on-accent hover:opacity-90",
  secondary: "border border-line-strong px-4 py-2 text-ink hover:bg-surface-hover",
  ghost: "px-3 py-1.5 text-ink-secondary hover:bg-surface-hover hover:text-ink",
};

/** Shared press/disabled/hover treatment for the app's button conventions
 * (previously copy-pasted per call site) — used by new/touched code, not a
 * retrofit of the ~20+ existing inline button className strings. */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button type="button" className={`${BASE_CLASS} ${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}
