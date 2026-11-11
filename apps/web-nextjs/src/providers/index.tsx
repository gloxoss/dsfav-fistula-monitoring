import type { ReactNode } from "react";

// Global client providers (query cache, theme, ...) land here in later milestones.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
