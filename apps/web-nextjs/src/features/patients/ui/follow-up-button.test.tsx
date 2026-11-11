import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowUpButton } from "./follow-up-button";

afterEach(cleanup);

describe("FollowUpButton", () => {
  it("records an intent and shows « aucune demande n’est envoyée »", async () => {
    const onRecordIntent = vi.fn().mockResolvedValue(undefined);

    render(
      <FollowUpButton
        idPseudo="PT-CAS-8841"
        measurementId="m-8"
        onRecordIntent={onRecordIntent}
      />,
    );

    expect(
      screen.getByText(/enregistre votre intention, aucune demande n’est envoyée/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /documenter une orientation écho-doppler/i }),
    );

    await waitFor(() => {
      expect(onRecordIntent).toHaveBeenCalledWith({
        idPseudo: "PT-CAS-8841",
        measurementId: "m-8",
      });
    });

    expect(
      await screen.findByText(/intention enregistrée · aucune demande n’est envoyée/i),
    ).toBeInTheDocument();
  });
});
