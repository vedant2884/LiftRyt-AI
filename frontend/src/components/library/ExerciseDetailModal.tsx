import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Heart,
  ListChecks,
  Loader2,
  Repeat,
  Ruler,
  Send,
  Share2,
  ShieldAlert,
  Timer,
  Wind,
  X,
} from "lucide-react";
import { fetchExerciseAlternatives } from "../../api/exercises";
import { sendChatMessage } from "../../api/chat";
import { describeChatError } from "../../lib/chatErrors";
import ExerciseMedia from "./ExerciseMedia";
import MarkdownMessage from "../MarkdownMessage";
import type { Exercise } from "../../types/exercise";

const humanize = (s: string) => s.replace(/_/g, " ");

const difficultyColor: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-400",
  intermediate: "bg-amber-500/15 text-amber-400",
  advanced: "bg-red-500/15 text-red-400",
};

const SUGGESTED_QUESTIONS = [
  "Is this good for beginners?",
  "Can I replace this with something else?",
  "Show me proper form tips.",
  "Is this enough for my goals?",
];

interface AskThreadEntry {
  question: string;
  answer: string;
}

interface ExerciseDetailModalProps {
  exercise: Exercise;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onSelectAlternative: (exercise: Exercise) => void;
  ensureCoachSession: () => Promise<string>;
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof ListChecks; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-5">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {Icon && <Icon size={13} />}
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ExerciseDetailModal({
  exercise,
  isFavorited,
  onToggleFavorite,
  onClose,
  onSelectAlternative,
  ensureCoachSession,
}: ExerciseDetailModalProps) {
  const reduceMotion = useReducedMotion();
  const [alternatives, setAlternatives] = useState<Exercise[]>([]);
  const [thread, setThread] = useState<AskThreadEntry[]>([]);
  const [askInput, setAskInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setAlternatives([]);
    setThread([]);
    setAskError(null);
    fetchExerciseAlternatives(exercise.id).then((results) => {
      if (!cancelled) setAlternatives(results);
    });
    return () => {
      cancelled = true;
    };
  }, [exercise.id]);

  const quickFacts = useMemo(
    () =>
      [
        { icon: Repeat, label: "Sets", value: exercise.recommended_sets },
        { icon: ListChecks, label: "Reps", value: exercise.recommended_reps },
        { icon: Timer, label: "Tempo", value: exercise.tempo },
        { icon: Ruler, label: "Range of motion", value: exercise.range_of_motion },
        { icon: Wind, label: "Breathing", value: exercise.breathing_tips },
      ].filter((f) => !!f.value),
    [exercise],
  );

  async function handleAsk(question: string) {
    const content = question.trim();
    if (!content || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const sessionId = await ensureCoachSession();
      const reply = await sendChatMessage(sessionId, content, {
        name: exercise.name,
        primary_muscles: exercise.primary_muscles,
        secondary_muscles: exercise.secondary_muscles,
        equipment: exercise.equipment,
        category: exercise.category,
        difficulty: exercise.difficulty,
      });
      setThread((prev) => [...prev, { question: content, answer: reply.content }]);
      setAskInput("");
    } catch (err) {
      setAskError(describeChatError(err, "Couldn't reach the coach. Please try again."));
    } finally {
      setAsking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleAsk(askInput);
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={exercise.name}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl md:max-w-2xl"
        initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
        animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
        transition={{ duration: reduceMotion ? 0.15 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative aspect-video w-full shrink-0 bg-bg">
          <ExerciseMedia exercise={exercise} variant="hero" className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 shadow-sm backdrop-blur-md transition hover:bg-bg/90 active:scale-90"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 pb-8 pt-5 sm:px-7">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">{exercise.name}</h1>
              <button
                type="button"
                onClick={() => onToggleFavorite(exercise.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  isFavorited
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line-strong text-ink-secondary hover:border-ink-muted"
                }`}
              >
                <Heart size={13} className={isFavorited ? "fill-accent text-accent" : ""} />
                {isFavorited ? "Favorited" : "Add to favorites"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${difficultyColor[exercise.difficulty]}`}>
                {exercise.difficulty}
              </span>
              <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs capitalize text-ink-secondary">
                {humanize(exercise.category)}
              </span>
              <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs capitalize text-ink-secondary">
                {exercise.movement_type}
              </span>
              <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs capitalize text-ink-secondary">
                {humanize(exercise.equipment)}
              </span>
            </div>

            <div className="mt-3 text-sm">
              <p className="text-ink-secondary">
                <span className="text-ink-muted">Primary: </span>
                {exercise.primary_muscles.map(humanize).join(", ")}
              </p>
              {exercise.secondary_muscles.length > 0 && (
                <p className="mt-0.5 text-ink-muted">
                  <span>Secondary: </span>
                  {exercise.secondary_muscles.map(humanize).join(", ")}
                </p>
              )}
            </div>
          </div>

          {exercise.description && (
            <p className="text-sm leading-relaxed text-ink-secondary">{exercise.description}</p>
          )}

          {quickFacts.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {quickFacts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-line bg-bg p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
                    <Icon size={12} />
                    {label}
                  </div>
                  <p className="mt-1 text-sm text-ink">{value}</p>
                </div>
              ))}
            </div>
          )}

          {exercise.instructions && exercise.instructions.length > 0 && (
            <Section title="Step-by-step" icon={ListChecks}>
              <ol className="space-y-2.5">
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink-secondary">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-medium text-accent">
                      {i + 1}
                    </span>
                    <span className="pt-px">{step}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {exercise.common_mistakes && exercise.common_mistakes.length > 0 && (
            <Section title="Common mistakes" icon={AlertTriangle}>
              <ul className="space-y-2">
                {exercise.common_mistakes.map((mistake, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-secondary">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                    {mistake}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(exercise.beginner_tips || exercise.advanced_tips) && (
            <Section title="Tips">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {exercise.beginner_tips && (
                  <div className="rounded-xl border border-line bg-bg p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Beginner</p>
                    <p className="mt-1 text-sm text-ink-secondary">{exercise.beginner_tips}</p>
                  </div>
                )}
                {exercise.advanced_tips && (
                  <div className="rounded-xl border border-line bg-bg p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Advanced</p>
                    <p className="mt-1 text-sm text-ink-secondary">{exercise.advanced_tips}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {exercise.safety_notes && (
            <Section title="Safety" icon={ShieldAlert}>
              <div className="flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-sm text-amber-200/90">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <p>{exercise.safety_notes}</p>
              </div>
            </Section>
          )}

          {alternatives.length > 0 && (
            <Section title="Alternative exercises" icon={ArrowLeftRight}>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => onSelectAlternative(alt)}
                    className="flex w-32 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-bg text-left transition hover:border-line-strong"
                  >
                    <div className="aspect-square w-full">
                      <ExerciseMedia exercise={alt} variant="card" className="h-full w-full" />
                    </div>
                    <p className="truncate px-2 py-1.5 text-xs text-ink">{alt.name}</p>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Ask the coach">
            <p className="mb-3 text-xs text-ink-muted">
              The coach already knows you're looking at {exercise.name}, no need to type its name.
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={asking}
                  onClick={() => handleAsk(q)}
                  className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-secondary transition hover:border-accent/50 hover:text-ink disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {thread.length > 0 && (
              <div className="mb-3 space-y-3">
                {thread.map((entry, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-sm font-medium text-ink">{entry.question}</p>
                    <div className="rounded-xl border border-line bg-bg p-3 text-sm text-ink-secondary">
                      <MarkdownMessage content={entry.answer} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {asking && (
              <div className="mb-3 flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            )}
            {askError && <p className="mb-3 text-sm text-red-400">{askError}</p>}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder={`Ask about ${exercise.name}...`}
                disabled={asking}
                className="flex-1 rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={asking || !askInput.trim()}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              LiftRyt AI can make mistakes. Check important info before relying on it.
            </p>
          </Section>

          <div className="flex items-center justify-between border-t border-line pt-5">
            <button
              type="button"
              onClick={() => onToggleFavorite(exercise.id)}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
            >
              <Heart size={14} className={isFavorited ? "fill-white" : ""} />
              {isFavorited ? "Favorited" : "Add to preferred exercises"}
            </button>
            <button
              type="button"
              title="Sharing is coming soon"
              disabled
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-sm text-ink-muted opacity-60"
            >
              <Share2 size={14} />
              Share
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export function ExerciseDetailModalRoot({
  exercise,
  ...rest
}: Omit<ExerciseDetailModalProps, "exercise"> & { exercise: Exercise | null }) {
  return (
    <AnimatePresence>
      {exercise && <ExerciseDetailModal key="exercise-detail-modal" exercise={exercise} {...rest} />}
    </AnimatePresence>
  );
}
