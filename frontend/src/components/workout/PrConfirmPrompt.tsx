import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface PrConfirmPromptProps {
  prWeightKg: number;
  incrementKg: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Shown inline right on the set that just PR'd — never a blocking modal,
 * and never applies anything on its own. A PR only ever offers to suggest
 * a next weight; the user has to explicitly confirm (or dismiss) every
 * single time, per exercise. Emerald/--success, not amber — PRs are a
 * "success" moment per the app's color system, not a caution. */
export default function PrConfirmPrompt({ prWeightKg, incrementKg, onConfirm, onDismiss }: PrConfirmPromptProps) {
  const reduceMotion = useReducedMotion();
  const nextWeight = prWeightKg + incrementKg;

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mx-2 mb-1.5 rounded-lg border border-success/25 bg-success/[0.06] px-3 py-2.5"
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-success">
        <Trophy size={14} />
        New PR! Increase next weight?
      </div>
      <p className="mb-2 text-xs text-ink-muted">
        {prWeightKg} kg + {incrementKg} kg &rarr; next suggested{" "}
        <span className="font-medium text-ink">{nextWeight} kg</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-black transition hover:opacity-90 active:scale-95"
        >
          +{incrementKg} kg
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-line-strong px-3 py-1.5 text-xs text-ink-secondary transition hover:bg-surface-hover active:scale-95"
        >
          Not now
        </button>
      </div>
    </motion.div>
  );
}
