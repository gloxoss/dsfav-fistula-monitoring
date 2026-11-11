import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLogPage, UserListPage } from "./admin-pages";

describe("Audit filters [UC13]", () => {
  afterEach(cleanup);
  const rows = [
    { id: "a1", action: "CLINICAL_NOTE_CREATED", entity: "ClinicalNote", entityId: "n1", actorRole: "NEPHROLOGIST" as const, at: "2026-11-10T09:00:00Z", after: null },
    { id: "a2", action: "DEVICE_CALIBRATED", entity: "Device", entityId: "dev-01-001", actorRole: "ADMIN" as const, at: "2026-11-10T08:00:00Z", after: null },
  ];
  it("[UC13] category chips filter the log and show French event names", () => {
    render(<AuditLogPage rows={rows} />);
    expect(screen.getByText("Note clinique ajoutée")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Appareils/ }));
    expect(screen.queryByText("Note clinique ajoutée")).toBeNull();
    expect(screen.getByText("Appareil étalonné")).toBeInTheDocument();
    expect(screen.getByTestId("audit-count")).toHaveTextContent("1 affiché sur 1");
  });
  it("[UC13] dates show day, month, year and time, not raw ISO", () => {
    render(<AuditLogPage rows={rows} />);
    expect(screen.queryByText(/2026-11-10T/)).toBeNull();
    expect(screen.getAllByText(/^10\/11\/2026 \d{2}:\d{2}$/).length).toBe(2);
  });
});

describe("Admin pages", () => {
  afterEach(cleanup);

  it("[PSEUDO-SCAN] audit rows expose actor role and sanitized calibration details only", () => {
    render(<AuditLogPage rows={[{
      id: "audit-1",
      action: "DEVICE_CALIBRATED",
      entity: "Device",
      entityId: "device-1",
      actorRole: "ADMIN",
      at: "2026-11-08T10:00:00Z",
      after: { calibrationGain: 1.02, reason: "Contrôle au banc" },
    }]} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Administrateur")).toBeInTheDocument();
    expect(within(table).getByText("device-1")).toBeInTheDocument();
    expect(within(table).getByText("Appareil étalonné")).toBeInTheDocument();
    expect(within(table).getByText("Gain")).toBeInTheDocument();
    expect(within(table).getByText("1,02")).toBeInTheDocument();
    expect(within(table).getByText("Contrôle au banc")).toBeInTheDocument();
    expect(within(table).queryByText(/@|nom|courriel/i)).not.toBeInTheDocument();
  });

  it("[PSEUDO-SCAN] user list renders role and status without account identifiers", () => {
    render(<UserListPage rows={[{ role: "ADMIN", status: "ACTIVE" }]} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Rôle", "État"]);
    expect(within(table).getByText("ADMIN")).toBeInTheDocument();
    expect(within(table).getByText("ACTIVE")).toBeInTheDocument();
  });

  it("[UC13] audit log displays 50 rows from a 120-row list, shows total shown, and loads more via cursor", () => {
    const fake120Rows = Array.from({ length: 120 }, (_, index) => ({
      id: `audit-${120 - index}`,
      action: "DEVICE_CALIBRATED",
      entity: "Device",
      entityId: `device-${(index % 3) + 1}`,
      actorRole: "ADMIN" as const,
      at: new Date(Date.UTC(2026, 10, 8, 12, 0, 120 - index)).toISOString(),
      after: { calibrationGain: 1.0 + index * 0.001, reason: `Calibration ${index + 1}` },
    }));

    render(<AuditLogPage rows={fake120Rows} />);

    const table = screen.getByRole("table");
    const tbody = table.querySelector("tbody")!;
    const initialRows = within(tbody).getAllByRole("row");
    expect(initialRows).toHaveLength(50);

    // Total shown so far
    expect(screen.getByTestId("audit-count")).toHaveTextContent("50 affichés sur 120");

    // Charger plus button
    const loadMoreBtn = screen.getByRole("button", { name: /charger plus/i });
    expect(loadMoreBtn).toBeInTheDocument();

    // Click Charger plus
    fireEvent.click(loadMoreBtn);

    const afterLoadRows = within(tbody).getAllByRole("row");
    expect(afterLoadRows).toHaveLength(100);
    expect(screen.getByTestId("audit-count")).toHaveTextContent("100 affichés sur 120");

    // Click Charger plus again for final 20 rows
    fireEvent.click(loadMoreBtn);
    const finalRows = within(tbody).getAllByRole("row");
    expect(finalRows).toHaveLength(120);
    expect(screen.getByTestId("audit-count")).toHaveTextContent("120 affichés sur 120");

    // After all loaded, load more button should disappear or be disabled
    expect(screen.queryByRole("button", { name: /charger plus/i })).not.toBeInTheDocument();
  });
});
