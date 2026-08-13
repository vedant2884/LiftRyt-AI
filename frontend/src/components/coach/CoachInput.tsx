import { forwardRef, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";

interface CoachInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Rounded pill with the send button integrated inside the field instead of
 * beside it (the premium-AI-chat convention), with a purple focus glow via
 * the shared --shadow-glow token. */
const CoachInput = forwardRef<HTMLInputElement, CoachInputProps>(function CoachInput(
  { value, onChange, onSubmit, disabled, placeholder = "Ask your coach anything..." },
  ref,
) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1.5 pr-1.5 pl-4 transition focus-within:border-accent/60 focus-within:shadow-glow"
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition hover:opacity-90 active:scale-[0.93] disabled:opacity-40 disabled:active:scale-100"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );
});

export default CoachInput;
