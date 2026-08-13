import DumbbellSpinner from "../DumbbellSpinner";

/** The "thinking" bubble — reuses DumbbellSpinner as-is (already animated
 * and reduced-motion-safe) inside a bubble carrying the purple->emerald
 * signature as a slowly-pulsing top accent bar (see @keyframes
 * coach-glow-pulse in index.css). */
export default function CoachThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="relative overflow-hidden rounded-xl border border-line bg-bg px-4 py-3">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ backgroundImage: "var(--gradient-brand)", animation: "coach-glow-pulse 1.6s ease-in-out infinite" }}
        />
        <DumbbellSpinner label="Thinking..." />
      </div>
    </div>
  );
}
