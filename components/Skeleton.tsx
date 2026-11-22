export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
export const Spinner = ({ className = "" }: { className?: string }) => (
  <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-label="Loading" />
);
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-52 w-full rounded-3xl sm:h-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
