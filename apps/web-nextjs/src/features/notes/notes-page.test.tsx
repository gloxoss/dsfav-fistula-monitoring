import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotesPage } from "./notes-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe("Notes page workspace layout [UC8]", () => {
  const rows = [
    { idPseudo: "PT-CAS-8841", kind: "NOTE" as const, createdAt: "2026-11-10T09:00:00Z", text: "Thrill stable." },
    { idPseudo: "PT-CAS-8841", kind: "FOLLOW_UP" as const, createdAt: "2026-11-09T09:00:00Z", text: "Revoir avec le néphrologue" },
  ];
  const patients = [
    { idPseudo: "PT-CAS-8841", fistula: "FAV radio-céphalique", side: "gauche" },
    { idPseudo: "PT-CAS-4471", fistula: "FAV brachio-céphalique", side: "droite" },
  ];

  it("[UC8] lists the patients as links, the selected one marked as current", () => {
    render(<NotesPage patients={patients} selectedPatient="PT-CAS-8841" rows={rows} />);
    const nav = screen.getByRole("navigation", { name: /patients/i });
    const current = within(nav).getByRole("link", { name: /PT-CAS-8841/ });
    expect(current).toHaveAttribute("href", "/notes?idPseudo=PT-CAS-8841");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /PT-CAS-4471/ })).toHaveAttribute("href", "/notes?idPseudo=PT-CAS-4471");
    expect(within(nav).getByText(/FAV brachio-céphalique/)).toBeInTheDocument();
  });

  it("[UC8] the timeline can be filtered to notes or follow-up intents", () => {
    render(<NotesPage patients={patients} selectedPatient="PT-CAS-8841" rows={rows} />);
    expect(screen.getByText("Thrill stable.")).toBeInTheDocument();
    expect(screen.getByText("Revoir avec le néphrologue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /suivis/i }));
    expect(screen.queryByText("Thrill stable.")).toBeNull();
    expect(screen.getByText("Revoir avec le néphrologue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /notes/i }));
    expect(screen.getByText("Thrill stable.")).toBeInTheDocument();
    expect(screen.queryByText("Revoir avec le néphrologue")).toBeNull();
  });
});

describe("Notes page composer and dates [UC8]", () => {
  it("[UC8] a nephrologist can write a note for the selected patient", async () => {
    const onAddNote = vi.fn().mockResolvedValue(undefined);
    render(<NotesPage patients={["PT-CAS-8841"]} selectedPatient="PT-CAS-8841" rows={[]} onAddNote={onAddNote} />);
    const save = screen.getByRole("button", { name: /enregistrer la note/i });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/nouvelle note pour PT-CAS-8841/i), { target: { value: "Thrill stable, à revoir lundi." } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(onAddNote).toHaveBeenCalledWith({ idPseudo: "PT-CAS-8841", text: "Thrill stable, à revoir lundi." }));
    expect(await screen.findByText(/note enregistrée/i)).toBeInTheDocument();
  });

  it("[UC8] without the add-note action (read-only role) no composer is shown", () => {
    render(<NotesPage patients={["PT-CAS-8841"]} selectedPatient="PT-CAS-8841" rows={[]} />);
    expect(screen.queryByRole("button", { name: /enregistrer la note/i })).toBeNull();
  });

  it("[UC8] dates are readable, never raw ISO strings", () => {
    render(<NotesPage patients={["PT-CAS-8841"]} selectedPatient="PT-CAS-8841" rows={[
      { idPseudo: "PT-CAS-8841", kind: "NOTE", createdAt: "2026-11-10T08:50:00.000Z", text: "Note." },
    ]} />);
    expect(screen.queryByText(/2026-11-10T08:50/)).toBeNull();
    expect(screen.getByText(/^10\/11 \d{2}:\d{2}$/)).toBeInTheDocument();
  });
});

describe("Notes page", () => {
  it("[UC8] shows the selected patient's notes and follow-up intents", () => {
    render(<NotesPage
      patients={["PT-CAS-8841"]}
      selectedPatient="PT-CAS-8841"
      rows={[
        { idPseudo: "PT-CAS-8841", kind: "NOTE", createdAt: "2026-11-08T10:00:00Z", text: "Thrill stable." },
        { idPseudo: "PT-CAS-8841", kind: "FOLLOW_UP", createdAt: "2026-11-08T09:00:00Z", text: "Revoir avec le néphrologue" },
      ]}
    />);
    expect(screen.getByText("Thrill stable.")).toBeInTheDocument();
    expect(screen.getByText("Revoir avec le néphrologue")).toBeInTheDocument();
  });

  it("[UC8] shows empty state with hint to add note from patient page when patient has no notes", () => {
    render(
      <NotesPage
        patients={["PT-CAS-8841", "PT-CAS-9912"]}
        selectedPatient="PT-CAS-8841"
        rows={[]}
      />,
    );
    expect(screen.getByText("Aucune note pour ce patient.")).toBeInTheDocument();
    expect(
      screen.getByText(/Vous pouvez ajouter une note ou une intention de suivi depuis la/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fiche du patient PT-CAS-8841/i })).toHaveAttribute(
      "href",
      "/patients/PT-CAS-8841",
    );
  });
});
