import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 max-w-[1440px] overflow-x-clip">
        {children}
      </main>
    </div>
  );
}
