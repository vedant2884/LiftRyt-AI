import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400";

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-neutral-400" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export { inputClass };
