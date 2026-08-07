import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

const inputClass =
  "w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-ink-secondary" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export { inputClass };
