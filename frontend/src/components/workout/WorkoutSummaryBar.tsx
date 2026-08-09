import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface WorkoutSummaryBarProps {
  startedAt: string;
  totalSets: number;
  totalVolumeKg: number;
  onFinish: () => void;
  finishing: boolean;
  canFinish: boolean;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatVolume(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}k kg` : `${Math.round(kg)} kg`;
}

/** Sticky live summary at the bottom of the active workout screen — sets,
 * volume, and duration update immediately as the workout changes, per the
 * spec's "compact live summary" requirement. */
export default function WorkoutSummaryBar({
  startedAt,
  totalSets,
  totalVolumeKg,
  onFinish,
  finishing,
  canFinish,
}: WorkoutSummaryBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));

  return (
    <div className="sticky bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="font-semibold text-ink">{totalSets}</span>{" "}
            <span className="text-ink-muted">{totalSets === 1 ? "set" : "sets"}</span>
          </div>
          <div>
            <span className="font-semibold text-ink">{formatVolume(totalVolumeKg)}</span>
          </div>
          <div>
            <span className="font-semibold text-ink">{formatDuration(elapsedSeconds)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing || !canFinish}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
        >
          {finishing && <Loader2 size={14} className="animate-spin" />}
          Finish Workout
        </button>
      </div>
    </div>
  );
}
