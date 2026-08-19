import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { fetchActivityCalendar } from "../api/workouts";
import { Skeleton } from "./Skeleton";
import type { CalendarDay } from "../types/workout";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Monthly activity calendar: filled dot = a logged workout, empty dot = no
 * workout (never styled as an error — a rest day is a normal outcome).
 * Clicking a day shows what was logged, or "No workout logged." Only past
 * and current dates are clickable/navigable; there's nothing to show for
 * the future. */
export default function ActivityCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActivityCalendar(year, month).then((res) => {
      if (!cancelled) {
        setDays(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const startWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const items: (number | null)[] = Array(startWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) items.push(d);
    return items;
  }, [year, month]);

  function goPrev() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNext() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const todayIso = isoDate(today);
  const selected = selectedDate ? byDate.get(selectedDate) ?? null : null;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="rounded-md p-1.5 text-ink-secondary transition hover:bg-surface-hover hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium">{monthLabel(year, month)}</p>
        <button
          type="button"
          onClick={goNext}
          disabled={isCurrentMonth}
          aria-label="Next month"
          className="rounded-md p-1.5 text-ink-secondary transition hover:bg-surface-hover hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-secondary"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-ink-muted">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const dateStr = `${year}-${pad(month)}-${pad(day)}`;
              const hasWorkout = byDate.has(dateStr);
              const isFuture = dateStr > todayIso;
              const isToday = dateStr === todayIso;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  disabled={isFuture}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md text-xs transition hover:bg-surface-hover disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <span className={isToday ? "font-semibold text-accent" : "text-ink-secondary"}>{day}</span>
                  <span
                    className={hasWorkout ? "h-2 w-2 rounded-full bg-accent" : "h-2 w-2 rounded-full border border-line-strong"}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </>
      )}

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                aria-label="Close"
                className="text-ink-muted transition hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            {selected && selected.workouts.length > 0 ? (
              <div className="space-y-3">
                {selected.workouts.map((w) => (
                  <div key={w.id} className="rounded-lg border border-line-strong p-3">
                    <p className="font-medium">{w.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatTime(w.performed_at)} &middot; {w.exercise_count} {w.exercise_count === 1 ? "exercise" : "exercises"} &middot;{" "}
                      {w.set_count} {w.set_count === 1 ? "set" : "sets"}
                    </p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {Math.round(w.total_volume_kg)} kg volume &middot; {formatDuration(w.duration_seconds)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No workout logged.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
