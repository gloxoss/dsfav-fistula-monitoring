import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/capture",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

afterEach(cleanup);

describe("UserMenu [AUTHZ-MATRIX]", () => {
  it("shows the profile as one button, and opens a menu with a logout action", () => {
    const onLogout = vi.fn();
    render(<UserMenu initials="INT" roleLabel="Interne" userId="u-intern-001" onLogout={onLogout} />);
    const trigger = screen.getByRole("button", { name: /menu du profil.*interne/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toHaveTextContent("u-intern-001");
    fireEvent.click(screen.getByRole("menuitem", { name: /se déconnecter/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<UserMenu initials="NEP" roleLabel="Néphrologue" userId="u-nephro-001" onLogout={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /menu du profil/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes when the user clicks outside", () => {
    render(<UserMenu initials="NEP" roleLabel="Néphrologue" userId="u-nephro-001" onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /menu du profil/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Sidebar stays in view", () => {
  it("is pinned to the viewport height so the profile never scrolls away", () => {
    render(<Sidebar user={{ role: "INTERN", id: "u-intern-001" }} />);
    const aside = screen.getByRole("complementary", { name: /navigation principale/i });
    expect(aside.className).toMatch(/\bsticky\b/);
    expect(aside.className).toMatch(/\bh-screen\b/);
    expect(aside.className).not.toMatch(/min-h-screen/);
    expect(screen.getByRole("button", { name: /menu du profil.*interne/i })).toBeInTheDocument();
  });
});
