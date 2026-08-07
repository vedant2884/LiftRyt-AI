export type ChartMode = "light" | "dark";

// Validated categorical palette (light + dark steps) from the dataviz
// skill's reference palette — slots 1-3 clear all-pairs CVD/contrast checks
// in both modes, so they're safe to use in fixed order for any chart with
// up to three series. Assigned by fixed order, never cycled.
const SERIES_LIGHT = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a" };
const SERIES_DARK = { blue: "#3987e5", orange: "#d95926", aqua: "#199e70" };

// Chrome matches this app's own surface/border/text tokens (index.css) so
// charts blend into the surrounding cards instead of looking like a
// separately-themed system bolted on.
const CHROME_LIGHT = {
  surface: "#ffffff",
  gridline: "#e5e5e5",
  axisLine: "#d4d4d4",
  textMuted: "#737373",
  textSecondary: "#525252",
};
const CHROME_DARK = {
  surface: "#171717",
  gridline: "#262626",
  axisLine: "#404040",
  textMuted: "#737373",
  textSecondary: "#a3a3a3",
};

export interface ChartTheme {
  seriesBlue: string;
  seriesOrange: string;
  seriesAqua: string;
  chartSurface: string;
  gridline: string;
  axisLine: string;
  textMuted: string;
  textSecondary: string;
}

export function getChartTheme(mode: ChartMode): ChartTheme {
  const series = mode === "light" ? SERIES_LIGHT : SERIES_DARK;
  const chrome = mode === "light" ? CHROME_LIGHT : CHROME_DARK;
  return {
    seriesBlue: series.blue,
    seriesOrange: series.orange,
    seriesAqua: series.aqua,
    chartSurface: chrome.surface,
    gridline: chrome.gridline,
    axisLine: chrome.axisLine,
    textMuted: chrome.textMuted,
    textSecondary: chrome.textSecondary,
  };
}
