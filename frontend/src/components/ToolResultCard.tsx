import type { MacroToolResult, SplitToolResult, ToolPayload } from "../types/chat";

function isSplitResult(payload: ToolPayload): payload is ToolPayload & { result: SplitToolResult } {
  return payload.name === "generate_workout_split" && "days" in payload.result;
}

function isMacroResult(payload: ToolPayload): payload is ToolPayload & { result: MacroToolResult } {
  return payload.name === "calculate_macros" && "target_calories" in payload.result;
}

/** Renders the coach's tool output as a deterministic, always-visible
 * structured card (bold day headers, bulleted exercises) rather than
 * trusting the model to transcribe the same numbers correctly in prose. */
export default function ToolResultCard({ payload }: { payload: ToolPayload }) {
  if ("error" in payload.result) {
    return null;
  }

  if (isSplitResult(payload)) {
    return (
      <div className="mt-2 space-y-3 rounded-lg border border-line-strong bg-bg/60 p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {payload.result.split_type}
        </p>
        {payload.result.days.map((day) => (
          <div key={day.day_number}>
            <p className="mb-1.5 font-semibold text-ink">
              Day {day.day_number}: {day.label}
            </p>
            <ul className="ml-4 list-disc space-y-1.5 text-ink-secondary">
              {day.exercises.map((ex) => (
                <li key={ex.name}>
                  <span className="text-ink">{ex.name}</span>
                  <span className="text-ink-muted">
                    {" "}
                    &middot; {ex.sets}&times;{ex.reps}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (isMacroResult(payload)) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-line-strong bg-bg/60 p-3 text-sm text-ink-secondary">
        <span>BMR: {payload.result.bmr}</span>
        <span>TDEE: {payload.result.tdee}</span>
        <span>Calories: {payload.result.target_calories}</span>
        <span>Protein: {payload.result.target_protein_g}g</span>
        <span>Carbs: {payload.result.target_carbs_g}g</span>
        <span>Fat: {payload.result.target_fat_g}g</span>
      </div>
    );
  }

  return null;
}
