import Link from "next/link";

export interface PatientNavOption {
  idPseudo: string;
  fistula?: string;
  side?: string;
}

/** Patient switcher shared by the notes and baseline-history pages: a column on desktop, a horizontal strip on small screens. */
export function PatientNav({
  options,
  current,
  basePath,
}: {
  options: PatientNavOption[];
  current?: string;
  basePath: string;
}) {
  return (
    <nav aria-label="Patients" className="space-y-2 lg:sticky lg:top-6 lg:self-start">
      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-text-label">Patients</p>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {options.map((option) => {
          const isCurrent = option.idPseudo === current;
          return (
            <li key={option.idPseudo} className="shrink-0 lg:shrink">
              <Link
                href={`${basePath}?idPseudo=${encodeURIComponent(option.idPseudo)}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`block min-h-11 cursor-pointer rounded-[16px] px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                  isCurrent
                    ? "bg-primary text-white shadow-sm"
                    : "bg-surface text-text-primary shadow-[var(--shadow-card)] hover:bg-well"
                }`}
              >
                <span className="block whitespace-nowrap font-mono text-sm font-medium">{option.idPseudo}</span>
                {option.fistula ? (
                  <span className={`block whitespace-nowrap text-xs ${isCurrent ? "text-white/80" : "text-text-secondary"}`}>
                    {option.fistula}
                    {option.side ? ` ${option.side}` : ""}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {options.length === 0 ? <li className="px-1 text-sm text-text-secondary">Aucun patient disponible.</li> : null}
      </ul>
    </nav>
  );
}
