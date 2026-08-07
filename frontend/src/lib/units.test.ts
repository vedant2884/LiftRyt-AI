import { describe, expect, it } from "vitest";
import { cmToIn, formatHeight, formatWeight, inToCm, kgToLb, lbToKg } from "./units";

describe("weight conversion", () => {
  it("converts kg to lb using the exact avoirdupois pound", () => {
    // 1 lb = 0.45359237 kg exactly, so 100 kg is a clean round-trip check.
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
  });

  it("round-trips kg -> lb -> kg", () => {
    expect(lbToKg(kgToLb(83.4))).toBeCloseTo(83.4, 6);
  });

  it("formats weight in kg by default", () => {
    expect(formatWeight(82.456, "kg")).toBe("82.5 kg");
  });

  it("formats weight in lb when requested", () => {
    expect(formatWeight(100, "lb")).toBe("220.5 lb");
  });
});

describe("length conversion", () => {
  it("converts cm to inches", () => {
    expect(cmToIn(180)).toBeCloseTo(70.866, 2);
  });

  it("round-trips cm -> in -> cm", () => {
    expect(inToCm(cmToIn(175))).toBeCloseTo(175, 6);
  });

  it("formats height in cm by default", () => {
    expect(formatHeight(180, "cm")).toBe("180.0 cm");
  });

  it("formats height in inches when requested", () => {
    expect(formatHeight(180, "in")).toBe("70.9 in");
  });
});
