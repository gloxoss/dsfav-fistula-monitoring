import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/login",
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/login");
  });

  it("[AUTHZ-MATRIX] [UC5] login form shows « Identifiant ou mot de passe incorrect » on 401", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials detail from upstream" }),
    });

    render(<LoginPage />);

    // Rework 2 item 3: Privacy notice is strictly accurate
    expect(screen.getByText(/strictement pseudonymisés/i)).toBeInTheDocument();

    const identifierInput = screen.getByLabelText(/identifiant/i);
    const passwordInput = screen.getByLabelText(/mot de passe/i);
    const submitButton = screen.getByRole("button", { name: /se connecter/i });

    fireEvent.change(identifierInput, { target: { value: "wrong-user" } });
    fireEvent.change(passwordInput, { target: { value: "wrong-password" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Identifiant ou mot de passe incorrect")).toBeInTheDocument();
    });
  });

  it("[AUTHZ-MATRIX] shows a French notice after session expiry", async () => {
    window.history.replaceState({}, "", "/login?expired=1");
    render(<LoginPage />);
    expect(await screen.findByText("Votre session a expiré. Veuillez vous reconnecter.")).toBeInTheDocument();
  });
});
