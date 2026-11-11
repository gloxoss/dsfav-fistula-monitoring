import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FistulaMap } from "./fistula-map";
import type { BaselineFeatures, SessionView } from "../model/types";

afterEach(cleanup);

const baseline = { rmsG: 0.145, peakFreqHz: 68 } as BaselineFeatures;
const latest = {
  measurementId: "m1",
  recordedAt: "2026-11-10T08:50:00Z",
  status: "NORMAL",
  rejectReason: null,
  rmsG: 0.19,
  peakFreqHz: 71,
  stenosisRatio: 0.3,
  deviationScore: 1.1,
  isUnusualEvolution: false,
  explanation: null,
  cleanDurationSec: 24.5,
  artifactPct: 2,
  avgPressureKpa: 5.4,
} as SessionView;

describe("FistulaMap [UC9]", () => {
  it("[UC9] offers four zones and starts on the anastomosis with the latest peak frequency", () => {
    render(<FistulaMap fistulaType="RADIO_CEPHALIC" armSide="LEFT" baseline={baseline} latest={latest} />);
    const group = screen.getByRole("radiogroup", { name: /zone de la fistule/i });
    expect(within(group).getAllByRole("radio").map((node) => node.textContent)).toEqual([
      "Anastomose",
      "Veine de drainage",
      "Site du capteur",
      "Artère d’apport",
    ]);
    expect(within(group).getByRole("radio", { name: "Anastomose" })).toBeChecked();
    const panel = screen.getByRole("region", { name: /détail de la zone/i });
    expect(panel).toHaveTextContent("71 Hz");
    expect(panel).toHaveTextContent("Référence 68 Hz");
  });

  it("[UC9] choosing a zone from the chips updates the panel with that zone's measure", () => {
    render(<FistulaMap fistulaType="RADIO_CEPHALIC" armSide="LEFT" baseline={baseline} latest={latest} />);
    fireEvent.click(screen.getByRole("radio", { name: "Veine de drainage" }));
    const panel = screen.getByRole("region", { name: /détail de la zone/i });
    expect(panel).toHaveTextContent("0,190 g");
    expect(panel).toHaveTextContent("+31 % vs référence");
    fireEvent.click(screen.getByRole("radio", { name: "Site du capteur" }));
    expect(panel).toHaveTextContent("5,4 kPa");
    expect(panel).toHaveTextContent("Cible 3,0 à 8,5 kPa");
  });

  it("[UC9] clicking the drawing itself selects the zone", () => {
    const { container } = render(<FistulaMap fistulaType="BRACHIO_CEPHALIC" armSide="RIGHT" baseline={baseline} latest={latest} />);
    const hotspot = container.querySelector('[data-zone="sensor"]');
    expect(hotspot).not.toBeNull();
    fireEvent.click(hotspot!);
    expect(screen.getByRole("radio", { name: "Site du capteur" })).toBeChecked();
  });

  it("[UC9] the artery is drawn for reference and says it is not measured", () => {
    render(<FistulaMap fistulaType="RADIO_CEPHALIC" armSide="LEFT" baseline={baseline} latest={latest} />);
    fireEvent.click(screen.getByRole("radio", { name: "Artère d’apport" }));
    expect(screen.getByRole("region", { name: /détail de la zone/i })).toHaveTextContent(/non mesurée/i);
  });

  it("[UC7] while the baseline is building it says so instead of comparing", () => {
    render(<FistulaMap fistulaType="RADIO_CEPHALIC" armSide="LEFT" baseline={null} latest={latest} />);
    const panel = screen.getByRole("region", { name: /détail de la zone/i });
    expect(panel).toHaveTextContent("71 Hz");
    expect(panel).toHaveTextContent("Référence en cours");
    expect(panel).not.toHaveTextContent(/vs référence/);
  });

  it("[UC9] with no valid session it shows a clear empty state", () => {
    render(<FistulaMap fistulaType="RADIO_CEPHALIC" armSide="LEFT" baseline={null} latest={null} />);
    expect(screen.getByRole("region", { name: /détail de la zone/i })).toHaveTextContent(/pas encore de mesure valide/i);
  });

  it("[UC9] the drawing is mirrored for a right arm and has a text alternative", () => {
    const { container } = render(<FistulaMap fistulaType="BRACHIO_CEPHALIC" armSide="RIGHT" baseline={baseline} latest={latest} />);
    expect(container.querySelector("svg")?.parentElement?.className).toMatch(/-scale-x-100/);
    expect(screen.getByRole("img", { name: /fistule FAV brachio-céphalique, bras droite/i })).toBeInTheDocument();
  });
});
