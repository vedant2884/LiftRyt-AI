import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToolResultCard from "./ToolResultCard";
import type { ToolPayload } from "../types/chat";

const splitPayload: ToolPayload = {
  name: "generate_workout_split",
  arguments: { days_per_week: 3, experience_level: "beginner", goal: "hypertrophy" },
  result: {
    split_type: "Full Body",
    days: [
      {
        day_number: 1,
        label: "Full Body",
        exercises: [
          { name: "Goblet Squat", sets: 3, reps: "8-12", reason: "Compound movement targeting quads." },
        ],
      },
    ],
  },
};

const macroPayload: ToolPayload = {
  name: "calculate_macros",
  arguments: { goal: "cut" },
  result: {
    bmr: 1780,
    tdee: 2759,
    target_calories: 2259,
    target_protein_g: 176,
    target_carbs_g: 247.6,
    target_fat_g: 62.8,
  },
};

const errorPayload: ToolPayload = {
  name: "calculate_macros",
  arguments: { goal: "cut" },
  result: { error: "No weight on file." },
};

describe("ToolResultCard", () => {
  it("renders nothing when the tool result is an error", () => {
    const { container } = render(<ToolResultCard payload={errorPayload} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the split plan directly, without needing a click to expand", () => {
    render(<ToolResultCard payload={splitPayload} />);
    expect(screen.getByText("Day 1: Full Body")).toBeInTheDocument();
    expect(screen.getByText("Goblet Squat")).toBeInTheDocument();
  });

  it("renders macro details directly", () => {
    render(<ToolResultCard payload={macroPayload} />);
    expect(screen.getByText("Calories: 2259")).toBeInTheDocument();
    expect(screen.getByText("Protein: 176g")).toBeInTheDocument();
  });
});
