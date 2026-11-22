export default function Loading() {
  return (
    <div className="space-y-5 rounded-3xl bg-slate-950 p-6" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-full bg-white/10" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-white/10 lg:col-span-2" /><div className="h-80 animate-pulse rounded-2xl bg-white/10" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/10" />)}</div>
    </div>
  );
}
