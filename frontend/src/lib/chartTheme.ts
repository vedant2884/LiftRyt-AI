export type ChartMode = "light" | "dark";

// Validated categorical palette (light + dark steps) from the dataviz
// skill's reference palette — slots 1-3 clear all-pairs CVD/contrast checks
// in both modes, so they're safe to use in fixed order for any chart with
// up to three series. Assigned by fixed order, never cycled.
const SERIES_LIGHT = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a" };
const SERIES_DARK = { blue: "#3987e5", orange: "#d95926", aqua: "#199e70" };

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

// Chrome reads the live --surface/--line/--line-strong/--ink-muted/
// --ink-secondary custom properties straight off <html> instead of hand-
// duplicating index.css's values here — those tokens are the single source
// of truth (this used to be a second copy that had to be kept in sync by
// hand whenever index.css changed).
function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartTheme(mode: ChartMode): ChartTheme {
  const series = mode === "light" ? SERIES_LIGHT : SERIES_DARK;
  return {
    seriesBlue: series.blue,
    seriesOrange: series.orange,
    seriesAqua: series.aqua,
    chartSurface: readToken("--surface"),
    gridline: readToken("--line"),
    axisLine: readToken("--line-strong"),
    textMuted: readToken("--ink-muted"),
    textSecondary: readToken("--ink-secondary"),
  };
}
