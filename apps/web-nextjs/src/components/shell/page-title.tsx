import type { ReactNode } from "react";

export interface PageTitleProps {
  first: string;
  rest?: string;
  actions?: ReactNode;
  subtitle?: string;
  className?: string;
}

export function PageTitle({ first, rest, actions, subtitle, className = "" }: PageTitleProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-2xl lg:text-[40px] font-semibold tracking-tight text-text-primary leading-tight">
          {first}
          {rest ? <span className="text-text-muted font-normal ml-2">{rest}</span> : null}
        </h1>
        {subtitle ? <p className="text-sm text-text-secondary mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
