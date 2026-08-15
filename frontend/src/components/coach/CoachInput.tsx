import { forwardRef, type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Mic } from "lucide-react";

interface CoachInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Minimal shape of the Web Speech API's SpeechRecognition — not part of
// TS's DOM lib, and only Chrome/Edge/Safari (webkit-prefixed) ship it, so
// it's feature-detected via the constructor lookup below rather than typed
// as a real global. Firefox has no implementation, so the mic button just
// doesn't render there.
interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SpeechRecognitionCtor = getSpeechRecognitionCtor();

/** Rounded pill with the send button integrated inside the field instead of
 * beside it (the premium-AI-chat convention), with a purple focus glow via
 * the shared --shadow-glow token. */
const CoachInput = forwardRef<HTMLInputElement, CoachInputProps>(function CoachInput(
  { value, onChange, onSubmit, disabled, placeholder = "Ask your coach anything..." },
  ref,
) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // What was already typed before dictation started — new speech is
  // appended after it rather than overwriting it, so tapping the mic mid
  // sentence doesn't erase what you'd already written.
  const baseValueRef = useRef("");

  // Stop any in-flight recognition if the component unmounts mid-dictation
  // (navigating away from the coach page while the mic is still listening).
  useEffect(() => () => recognitionRef.current?.stop(), []);

  function toggleListening() {
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    baseValueRef.current = value;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      const prefix = baseValueRef.current ? `${baseValueRef.current} ` : "";
      onChange(`${prefix}${transcript}`);
    };
    // Permission denied, no speech detected, network error, etc. — the
    // browser's own mic indicator communicates most of these; we just fall
    // back to normal typing rather than layering on a second error surface.
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1.5 pr-1.5 pl-4 transition focus-within:border-accent/60 focus-within:shadow-glow"
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={listening ? "Listening..." : placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted disabled:opacity-50"
      />
      {SpeechRecognitionCtor && (
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-[0.93] disabled:opacity-40 ${
            listening ? "animate-pulse bg-red-500 text-white" : "text-ink-muted hover:bg-surface-hover"
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
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
