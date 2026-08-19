import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

/** Styled <select>, matching the app's text inputs. Native selects largely
 * ignore custom border/background classes and fall back to the OS's own
 * control chrome unless `appearance-none` is set explicitly (most visible
 * in dark mode, where the native dropdown arrow/border don't follow the
 * page theme at all) — this sets that and draws its own chevron instead of
 * relying on the browser's. Uses the same CSS-variable-backed tokens as
 * every other input, so it already tracks dark/light/system and the
 * purple/emerald accent choice without any extra work. */
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none rounded-md border border-line-strong bg-bg px-3 py-2 pr-9 text-sm text-ink outline-none transition focus:border-accent ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}
