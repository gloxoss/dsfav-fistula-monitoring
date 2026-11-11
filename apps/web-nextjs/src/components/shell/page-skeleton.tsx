export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Chargement…</span>
      <div className="h-6 w-2/5 rounded-lg bg-well" />
      <div className="h-24 rounded-[20px] bg-well" />
      <div className="h-40 rounded-[20px] bg-well" />
    </div>
  );
}
