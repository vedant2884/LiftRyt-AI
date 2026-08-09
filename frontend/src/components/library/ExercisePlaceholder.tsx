import { Activity, Dumbbell, Flame, Footprints, Zap } from "lucide-react";
import type { ExerciseCategory } from "../../types/exercise";

/** No real exercise photography/video exists yet, so every thumbnail falls
 * back here instead of ever rendering a broken image. A muted brand-color
 * glow plus a category glyph reads as "designed placeholder", not "missing
 * asset" — the same trick Linear/Vercel use for imageless cards. */
const ICON_BY_CATEGORY: Record<ExerciseCategory, typeof Dumbbell> = {
  push: Dumbbell,
  pull: Activity,
  legs: Footprints,
  upper: Dumbbell,
  lower: Footprints,
  full_body: Zap,
  core: Flame,
};

interface ExercisePlaceholderProps {
  category: ExerciseCategory;
  name: string;
  scaled?: boolean;
  size?: number;
}

export default function ExercisePlaceholder({
  category,
  name,
  scaled = false,
  size = 34,
}: ExercisePlaceholderProps) {
  const Icon = ICON_BY_CATEGORY[category] ?? Dumbbell;

  return (
    <div
      role="img"
      aria-label={name}
      className={`relative flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-bg transition-transform duration-500 ease-out ${
        scaled ? "scale-105" : "scale-100"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 26% 22%, var(--accent), transparent 55%), radial-gradient(circle at 82% 86%, var(--accent), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <Icon size={size} strokeWidth={1.5} className="relative text-accent/60" />
    </div>
  );
}
