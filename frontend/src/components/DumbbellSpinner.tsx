import { motion } from "framer-motion";

interface DumbbellSpinnerProps {
  size?: number;
  label?: string;
}

/** A spinning dumbbell used as the "the coach is thinking" indicator —
 * rotates around its own center like a bar spinning between reps. */
export default function DumbbellSpinner({ size = 20, label }: DumbbellSpinnerProps) {
  return (
    <div className="flex items-center gap-2">
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="text-accent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
      >
        {/* bar */}
        <line x1="7" y1="12" x2="17" y2="12" strokeWidth="2" strokeLinecap="round" />
        {/* left plates */}
        <rect x="1" y="8" width="3" height="8" rx="1" strokeWidth="1.5" />
        <rect x="4.5" y="6" width="2.5" height="12" rx="1" strokeWidth="1.5" />
        {/* right plates */}
        <rect x="20" y="8" width="3" height="8" rx="1" strokeWidth="1.5" />
        <rect x="17" y="6" width="2.5" height="12" rx="1" strokeWidth="1.5" />
      </motion.svg>
      {label && <span className="text-sm text-ink-muted">{label}</span>}
    </div>
  );
}
