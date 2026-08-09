import { useEffect, useRef, useState } from "react";
import { Pause, RotateCcw, Timer } from "lucide-react";
import { useActiveWorkoutStore } from "../../store/activeWorkoutStore";
import { toast } from "../../store/toastStore";

const PRESETS = [60, 90, 120];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Rest timer — accessible without leaving the active workout screen, kept
 * visually secondary to the actual set-logging. restEndsAt is an absolute
 * timestamp (not a running countdown value), so it survives a reload
 * correctly: remaining time is always just "endsAt - now". */
export default function RestTimer() {
  const restEndsAt = useActiveWorkoutStore((s) => s.restEndsAt);
  const restDurationSeconds = useActiveWorkoutStore((s) => s.restDurationSeconds);
  const startRestTimer = useActiveWorkoutStore((s) => s.startRestTimer);
  const stopRestTimer = useActiveWorkoutStore((s) => s.stopRestTimer);

  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!restEndsAt) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [restEndsAt]);

  const remaining = restEndsAt
    ? Math.max(0, Math.round((new Date(restEndsAt).getTime() - now) / 1000))
    : restDurationSeconds;

  useEffect(() => {
    if (restEndsAt && remaining === 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.info("Rest complete");
      stopRestTimer();
    }
    if (!restEndsAt) notifiedRef.current = false;
  }, [restEndsAt, remaining, stopRestTimer]);

  if (!restEndsAt) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <Timer size={14} /> Rest
        </span>
        {PRESETS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => startRestTimer(seconds)}
            className="rounded-md border border-line-strong px-2.5 py-1 text-xs transition hover:bg-surface-hover active:scale-95"
          >
            {seconds}s
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-accent">
        <Timer size={14} />
        {formatTime(remaining)}
      </span>
      <button
        type="button"
        onClick={stopRestTimer}
        aria-label="Pause rest timer"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover"
      >
        <Pause size={13} />
      </button>
      <button
        type="button"
        onClick={() => startRestTimer(restDurationSeconds)}
        aria-label="Reset rest timer"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover"
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}
