import { motion, useReducedMotion } from "framer-motion";
import { DumbbellIcon } from "../icons";
import { Badge } from "../Badge";
import { Button } from "../Button";

interface CoachEmptyStateProps {
  onStartConversation: () => void;
}

/** First thing a user sees on the Coach page — the purple->emerald glow
 * blob behind this block is the brand-gradient "signature" placement (see
 * index.css's --gradient-brand). */
export default function CoachEmptyState({ onStartConversation }: CoachEmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-10 blur-3xl"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      />

      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1">
          <DumbbellIcon className="h-3 w-3 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Gym AI Coach
          </span>
          <Badge variant="beta">Beta</Badge>
        </div>
        <h2 className="text-xl font-semibold text-ink">Your training. Your data. Your coach.</h2>
        <p className="text-sm text-ink-muted">Ask anything about your workouts, progress, nutrition, or training.</p>
      </div>

      <Button variant="primary" onClick={onStartConversation} className="relative px-5 py-2.5">
        Start a conversation
      </Button>
    </motion.div>
  );
}
