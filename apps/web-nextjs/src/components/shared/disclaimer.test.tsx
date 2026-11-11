import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Disclaimer } from "./disclaimer";

it("[DISCLAIMER] renders the exact clinical disclaimer", () => {
  render(<Disclaimer />);
  expect(
    screen.getByText(
      "Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.",
    ),
  ).toBeInTheDocument();
});
