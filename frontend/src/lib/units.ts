import type { LengthUnit, WeightUnit } from "../types/user";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

/** Formats a weight stored in kg for display in the user's preferred unit. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return unit === "lb" ? `${kgToLb(kg).toFixed(1)} lb` : `${kg.toFixed(1)} kg`;
}

/** Formats a length stored in cm for display in the user's preferred unit. */
export function formatHeight(cm: number, unit: LengthUnit): string {
  return unit === "in" ? `${cmToIn(cm).toFixed(1)} in` : `${cm.toFixed(1)} cm`;
}
