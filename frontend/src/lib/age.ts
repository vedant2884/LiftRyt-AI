/** Mirrors backend/app/services/age_calculation.py's calculate_age exactly
 * (same "has the birthday happened yet this year" comparison, not a naive
 * currentYear - birthYear) — used only for the live age preview next to
 * the date-of-birth field. The backend is still the actual source of
 * truth; this never gets sent anywhere, just displayed. */
export function calculateAge(dateOfBirth: string, asOf: Date = new Date()): number {
  const dob = new Date(dateOfBirth + "T00:00:00");
  let age = asOf.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    asOf.getMonth() > dob.getMonth() ||
    (asOf.getMonth() === dob.getMonth() && asOf.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/** Today, as "YYYY-MM-DD" — the max attribute for every date-of-birth
 * input, so the browser's own picker won't even offer a future date. */
export const MAX_DATE_OF_BIRTH = new Date().toISOString().slice(0, 10);
