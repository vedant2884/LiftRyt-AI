import {
  forwardRef,
  type FormEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ArrowUp, Mic, Square } from "lucide-react";

interface CoachInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Presence (not truthiness) drives the swap: passing a callback turns
   * the send button into a Stop button, matching CoachPage only ever
   * passing this while a reply is actively generating. */
  onStop?: () => void;
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

// Grows with content up to ~6 lines, then the textarea itself scrolls
// instead of the composer (and page) growing without bound.
const MAX_TEXTAREA_HEIGHT_PX = 160;

/** Multiline composer, sized like a modern AI chat box: the textarea grows
 * with content up to a max height (then scrolls internally) while the
 * mic/send controls stay pinned to their own corner instead of the text
 * ever running underneath them. Enter sends, Shift+Enter inserts a
 * newline — the pre-existing single-line behavior, just extended. */
const CoachInput = forwardRef<HTMLTextAreaElement, CoachInputProps>(function CoachInput(
  { value, onChange, onSubmit, disabled, placeholder = "Ask your coach anything...", onStop },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // What was already typed before dictation started — new speech is
  // appended after it rather than overwriting it, so tapping the mic mid
  // sentence doesn't erase what you'd already written.
  const baseValueRef = useRef("");

  // Stop any in-flight recognition if the component unmounts mid-dictation
  // (navigating away from the coach page while the mic is still listening).
  useEffect(() => () => recognitionRef.current?.stop(), []);

  // Auto-grow: reset to measure the natural content height, then clamp to
  // the max — resetting first is what lets the textarea shrink back down
  // too (e.g. after deleting most of a long message), not just grow.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [value]);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter (or any IME composition, e.g. mid-input for Hindi/Marathi
    // transliteration keyboards) falls through to the textarea's own
    // newline/composition handling instead of submitting.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface py-2 pr-2 pl-4 transition focus-within:border-accent/60 focus-within:shadow-glow"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={listening ? "Listening..." : placeholder}
        disabled={disabled}
        rows={1}
        style={{ maxHeight: MAX_TEXTAREA_HEIGHT_PX }}
        className="min-h-8 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm leading-normal text-ink outline-none placeholder:text-ink-muted disabled:opacity-50"
      />
      <div className="flex shrink-0 items-center gap-1">
        {SpeechRecognitionCtor && !onStop && (
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
        {onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition hover:opacity-90 active:scale-[0.93]"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition hover:opacity-90 active:scale-[0.93] disabled:opacity-40 disabled:active:scale-100"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
});

export default CoachInput;
