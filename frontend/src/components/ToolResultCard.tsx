import { useState } from "react";
import type { MacroToolResult, SplitToolResult, ToolPayload } from "../types/chat";

function isSplitResult(payload: ToolPayload): payload is ToolPayload & { result: SplitToolResult } {
  return payload.name === "generate_workout_split" && "days" in payload.result;
}

function isMacroResult(payload: ToolPayload): payload is ToolPayload & { result: MacroToolResult } {
  return payload.name === "calculate_macros" && "target_calories" in payload.result;
}

const toolLabel: Record<string, string> = {
  generate_workout_split: "Generated a workout split",
  calculate_macros: "Calculated macro targets",
};

export default function ToolResultCard({ payload }: { payload: ToolPayload }) {
  const [expanded, setExpanded] = useState(false);

  if ("error" in payload.result) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg border border-neutral-700 bg-neutral-950/60 text-xs">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-violet-400 hover:text-violet-300"
      >
        <span>&#128295;</span>
        <span>{toolLabel[payload.name] ?? payload.name}</span>
        <span className="ml-auto text-neutral-500">{expanded ? "hide" : "view details"}</span>
      </button>

      {expanded && isSplitResult(payload) && (
        <div className="space-y-2 border-t border-neutral-800 px-3 py-2">
          <p className="text-neutral-400">{payload.result.split_type}</p>
          {payload.result.days.map((day) => (
            <div key={day.day_number}>
              <p className="font-medium text-neutral-300">
                Day {day.day_number}: {day.label}
              </p>
              <ul className="ml-3 list-disc text-neutral-500">
                {day.exercises.map((ex) => (
                  <li key={ex.name}>
                    {ex.name} — {ex.sets}&times;{ex.reps}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {expanded && isMacroResult(payload) && (
        <div className="grid grid-cols-2 gap-2 border-t border-neutral-800 px-3 py-2 text-neutral-400">
          <span>BMR: {payload.result.bmr}</span>
          <span>TDEE: {payload.result.tdee}</span>
          <span>Calories: {payload.result.target_calories}</span>
          <span>Protein: {payload.result.target_protein_g}g</span>
          <span>Carbs: {payload.result.target_carbs_g}g</span>
          <span>Fat: {payload.result.target_fat_g}g</span>
        </div>
      )}
    </div>
  );
}
