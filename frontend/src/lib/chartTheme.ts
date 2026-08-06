// Validated categorical palette (dark-mode steps) from the dataviz skill's
// reference palette — slots 1-3 are the set that clears all-pairs CVD/contrast
// checks in both light and dark, so they're safe to use in fixed order for
// any chart with up to three series. Assigned by fixed order, never cycled.
export const seriesBlue = "#3987e5"; // slot 1 — raw daily weight
export const seriesOrange = "#d95926"; // slot 2 — 7-day moving average
export const seriesAqua = "#199e70"; // slot 3 — 30-day moving average

export const chartSurface = "#171717"; // ~ Tailwind neutral-900, matches existing cards
export const gridline = "#2c2c2a";
export const axisLine = "#383835";
export const textMuted = "#898781";
export const textSecondary = "#c3c2b7";
