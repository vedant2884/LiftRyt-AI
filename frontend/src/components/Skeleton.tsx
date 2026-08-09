interface SkeletonProps {
  className?: string;
}

/** A gray pulsing placeholder block shaped like the content that will load
 * in. Pass sizing/shape via className (e.g. "h-8 w-24 rounded-md"). */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-surface-hover ${className}`} aria-hidden />;
}

/** Three stat-card skeletons in a row, matching the shape used by Weight
 * Tracker / Dashboard stat cards (label + big number). */
export function StatCardSkeletonRow({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}
