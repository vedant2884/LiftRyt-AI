import { Trophy } from "lucide-react";

interface PrConfirmPromptProps {
  prWeightKg: number;
  incrementKg: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Shown inline right on the set that just PR'd — never a blocking modal,
 * and never applies anything on its own. A PR only ever offers to suggest
 * a next weight; the user has to explicitly confirm (or dismiss) every
 * single time, per exercise. */
export default function PrConfirmPrompt({ prWeightKg, incrementKg, onConfirm, onDismiss }: PrConfirmPromptProps) {
  const nextWeight = prWeightKg + incrementKg;

  return (
    <div className="mx-2 mb-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-300">
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
          className="rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-amber-500 active:scale-95"
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
    </div>
  );
}
