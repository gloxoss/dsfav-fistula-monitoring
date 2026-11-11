import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  connection: () => new Promise<void>(() => {}),
}));

vi.mock("@/features/queue/data/queue-api", () => ({ getQueue: vi.fn() }));
vi.mock("@/features/devices/data/devices-api", () => ({
  getActiveClinicalConfig: vi.fn(),
  getDevices: vi.fn(),
  getSessionRole: vi.fn(),
}));
vi.mock("@/features/patients/data/patients-api", () => ({
  getActiveClinicalConfig: vi.fn(),
  getPatientHistory: vi.fn(),
  getPatientNotes: vi.fn(),
  getPatients: vi.fn(),
  getSessionRole: vi.fn(),
}));

import DashboardPage from "./page";
import DevicesPage from "../devices/page";
import PatientsPage from "../patients/page";
import PatientDetailPage from "../patients/[idPseudo]/page";

describe("[UC8] clinic page Suspense fallbacks", () => {
  it("shows the loading fallback on all four routes before request data resolves", () => {
    const pages = [
      createElement(DashboardPage),
      createElement(DevicesPage),
      createElement(PatientsPage),
      createElement(PatientDetailPage, { params: Promise.resolve({ idPseudo: "pseudo-1" }) }),
    ];

    for (const page of pages) {
      const html = renderToString(page);
      expect(html).toContain("Chargement…");
      expect(html).toContain('role="status"');
    }
  });
});
