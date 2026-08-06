import { useEffect, useState } from "react";
import { fetchExercises } from "../api/exercises";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import type { Exercise } from "../types/exercise";

interface ExercisePickerProps {
  value: Exercise | null;
  onChange: (exercise: Exercise) => void;
}

export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [results, setResults] = useState<Exercise[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchExercises({ q: debouncedQuery || undefined, limit: 15 }).then((res) =>
      setResults(res.items),
    );
  }, [debouncedQuery, open]);

  return (
    <div className="relative">
      <input
        placeholder="Search exercise..."
        value={open ? query : (value?.name ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(ex);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-800"
              >
                {ex.name}
                <span className="ml-2 text-xs text-neutral-500">{ex.equipment}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
