import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spectrogram } from "./spectrogram";

describe("Spectrogram component", () => {
  it("renders cells from a small fixture, axis labels in Hz and s, legend", () => {
    // 3 frequency bins (rows) x 4 time frames (cols)
    const smallFixture = [
      [0.1, 0.2, 0.3, 0.4],
      [0.5, 0.8, 0.9, 0.6],
      [0.2, 0.3, 0.4, 0.1],
    ];

    render(
      <Spectrogram
        matrix={smallFixture}
        durationSec={25}
        maxFreqHz={400}
        dominantFreqHz={200}
        title="Spectrogramme du signal"
      />,
    );

    // Axis labels in Hz and s
    expect(screen.getAllByText(/Hz/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/s\b/i).length).toBeGreaterThan(0);

    // Legend
    expect(screen.getByText(/énergie/i)).toBeInTheDocument();

    // Renders cells from small fixture (3 * 4 = 12 cells)
    const cells = screen.getAllByTestId("spectrogram-cell");
    expect(cells.length).toBe(12);

    // Dominant frequency indicator
    expect(screen.getAllByText(/200\s*Hz/i).length).toBeGreaterThan(0);
  });
});
