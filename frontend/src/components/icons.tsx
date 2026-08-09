import type { SVGProps } from "react";

/** Small stroke-based icon set matching the landing page's icon style
 * (24x24 viewBox, currentColor stroke) — used by EmptyState and stat cards
 * so icons are consistent instead of each screen picking its own style. */

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function ScaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 3h6" />
      <path d="M12 3v2" />
    </IconBase>
  );
}

export function DumbbellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 8v8M18 8v8M2 12h2M20 12h2M6 12h12" />
    </IconBase>
  );
}

export function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </IconBase>
  );
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 17 9 11l4 4 8-8M15 6h6v6" />
    </IconBase>
  );
}

export function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 1 2 2.5 2 4.5A5.5 5.5 0 0 1 6 14.5C6 9 12 6 12 2Z" />
    </IconBase>
  );
}

export function CalendarCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M8.5 14.5 11 17l4.5-5" />
    </IconBase>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </IconBase>
  );
}
