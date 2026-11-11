import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchClient } from "./bench-client";
import { revealBenchSession } from "../data/bench-api";
import { resolveBenchDeviceId } from "../model/bench-device";
import { BENCH_DEVICE_CONFIG_ERROR } from "../model/constants";
import { DISCLAIMER } from "@/libs/clinical/disclaimer";
import type { BenchSessionResult, BenchSessionSummary } from "../model/types";

const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const INTERN_ID = "33333333-3333-4333-8333-333333333333";
const MEASUREMENT_ID = "44444444-4444-4444-8444-444444444444";
const DEVICE_ID = "55555555-5555-4555-8555-555555555555";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.readyState = 3;
  }
  send(data: string) {
    this.sent.push(data);
  }
}

const LOCKED_SESSION: BenchSessionSummary = {
  id: SESSION_ID,
  internId: INTERN_ID,
  measurementId: null,
  pumpFlowMlMin: 450,
  clampStenosisPct: 50,
  perceivedThrill: "SYSTOLIC_ROUGH",
  perceivedIntensity: 4,
  concordanceScore: null,
  createdAt: "2026-11-07T12:00:00.000Z",
};

const OPEN_SESSION: BenchSessionSummary = {
  ...LOCKED_SESSION,
  perceivedThrill: null,
  perceivedIntensity: null,
};

function result(overrides: Partial<BenchSessionResult> = {}): BenchSessionResult {
  return {
    sessionId: SESSION_ID,
    internId: INTERN_ID,
    measurementId: MEASUREMENT_ID,
    pumpFlowMlMin: 450,
    clampStenosisPct: 50,
    perceivedThrill: "SYSTOLIC_ROUGH",
    perceivedIntensity: 4,
    concordanceScore: 92,
    expectedProfile: "SYSTOLIC_ROUGH",
    concordanceBreakdown: {
      sensationScorePct: 55,
      intensityScorePct: 22,
      notesScorePct: 15,
    },
    internNotes: "Frémissement perçu modéré avec renforcement systolique",
    disclaimer: "Simulation sur banc, pas de donnée patient",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("Training bench screen TDD tests", { timeout: 15000 }, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
  });

  it("[UC10] step 1 configures the bench and initializes a session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(OPEN_SESSION, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient />);

    expect(screen.getByText(/réglage du banc/i)).toBeInTheDocument();
    expect(screen.getByText("1. Configurer le banc")).toBeInTheDocument();
    expect(screen.getByText("2. Décrire la palpation avant de voir les mesures")).toBeInTheDocument();
    expect(screen.getByText("3. Comparer avec les mesures")).toBeInTheDocument();
    expect(screen.getByLabelText(/débit de la pompe/i)).toHaveValue("450");
    expect(screen.getByRole("button", { name: "0 %" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 %" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50 %" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "75 %" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /initialiser le banc/i }));

    expect(await screen.findByText(/décrivez votre palpation/i)).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/bench\/sessions$/);
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toEqual({
      pumpFlowMlMin: 450,
      clampStenosisPct: 50,
    });
  });

  it("[UC11] the reveal action stays unavailable until the palpation is locked", () => {
    render(<BenchClient initialSession={OPEN_SESSION} />);

    expect(screen.getByRole("button", { name: /valider mon observation/i })).toBeDisabled();
    expect(screen.getByText(/choisissez une sensation et une intensité/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /révéler la mesure/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("Les signaux sont masqués jusqu’à la validation de votre observation"),
    ).toBeInTheDocument();
  });

  it("[UC11] bench reveal stays hidden until the palpation answer is saved", () => {
    render(
      <BenchClient
        initialSession={OPEN_SESSION}
        measurementId={MEASUREMENT_ID}
        objective={{ rmsG: 0.094, peakFreqHz: 137, ratioHighLow: 1.42 }}
      />,
    );

    expect(screen.queryByRole("button", { name: /révéler la mesure/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("bench-reveal-hidden-notice")).toHaveTextContent(
      "Les signaux sont masqués jusqu’à la validation de votre observation",
    );
    expect(screen.queryByText("137 Hz")).not.toBeInTheDocument();
    expect(screen.queryByText(/indicateur pédagogique/i)).not.toBeInTheDocument();
  });

  it("[UC11] capture refused by the server before the palpation is saved (mocked 409) shows the refusal and no objective data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { code: "PALPATION_REQUIRED", message_fr: "Décrivez d’abord votre palpation", retryable: false },
          409,
        ),
      ),
    );

    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Décrivez d’abord votre palpation");
    expect(screen.queryByText(/indicateur pédagogique/i)).not.toBeInTheDocument();
    expect(screen.queryByText("92 %")).not.toBeInTheDocument();
  });

  it("[UC11] revealBenchSession surfaces the server message on a 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { code: "PALPATION_REQUIRED", message_fr: "Décrivez d’abord votre palpation", retryable: false },
          409,
        ),
      ),
    );

    await expect(revealBenchSession(SESSION_ID, MEASUREMENT_ID)).rejects.toMatchObject({
      status: 409,
      data: { message_fr: "Décrivez d’abord votre palpation" },
    });
  });

  it("[UC10] reveal after save shows the concordance score labelled pedagogical indicator with its breakdown", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(result()));
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    expect(await screen.findByText("92 %")).toBeInTheDocument();
    expect(screen.getByText(/indicateur pédagogique/i)).toBeInTheDocument();
    expect(screen.getByText("Catégorie 55/60")).toBeInTheDocument();
    expect(screen.getByText("Intensité 22/25")).toBeInTheDocument();
    expect(screen.getByText("Note 15/15")).toBeInTheDocument();
    expect(screen.getAllByText("Simulation sur banc, pas de donnée patient").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /enregistrer la séance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recommencer/i })).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(new RegExp(`/bench/sessions/${SESSION_ID}/capture$`));
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toEqual({ measurementId: MEASUREMENT_ID });
  });

  it("[UC11] live mode never renders a frequency that did not come from the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(result({ expectedProfile: "à calibrer" }))),
    );

    render(
      <BenchClient
        initialSession={LOCKED_SESSION}
        measurementId={MEASUREMENT_ID}
        objective={{ rmsG: 0.094, peakFreqHz: 137, ratioHighLow: 1.42 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    expect(await screen.findByText("137 Hz")).toBeInTheDocument();
    expect(screen.queryByText(/100\s*(?:à|–|-)\s*350/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/venturi/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/178\s*Hz/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Profil attendu : à calibrer").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(
        "Un rétrécissement accélère le flux et modifie le contenu fréquentiel du signal. Interprétation pédagogique, pas un diagnostic.",
      ),
    ).toBeInTheDocument();
  });

  it("[UC11] live mode without objective data renders no frequency at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(result({ expectedProfile: "à calibrer" }))),
    );

    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    expect(await screen.findByText("92 %")).toBeInTheDocument();
    expect(screen.queryByText(/Hz/)).not.toBeInTheDocument();
  });

  it("[UC10] the locked palpation is read-only after validation", () => {
    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);

    expect(screen.getByText(/renforcement systolique rugueux/i)).toBeInTheDocument();
    expect(screen.getByText("4 / 5")).toBeInTheDocument();
    expect(screen.getByText(/verrouillée/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/note libre/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /valider mon observation/i })).not.toBeInTheDocument();
  });

  it("[DISCLAIMER] the mandatory disclaimer is visible on the bench screen", () => {
    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it("[UC10] low concordance is shown in amber with the gap message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(result({ concordanceScore: 38 }))));

    const { container } = render(
      <BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    expect(await screen.findByText("38 %")).toBeInTheDocument();
    expect(
      screen.getByText("Écart important entre votre sensation et la mesure."),
    ).toBeInTheDocument();
    expect(container.querySelector('[class*="warning"]')).not.toBeNull();
  });

  it("[UC10] a rejected capture shows the canonical message and a restart action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            code: "MEASUREMENT_INVALID",
            message_fr: "Mesure inutilisable : mouvement trop important. Recommencez la capture.",
            retryable: true,
          },
          400,
        ),
      ),
    );

    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mesure inutilisable : mouvement trop important. Recommencez la capture.",
    );
    expect(screen.getByRole("button", { name: /recommencer la capture/i })).toBeInTheDocument();
  });

  it("[UC10] a network failure shows the French error with a Réessayer action", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient initialSession={LOCKED_SESSION} measurementId={MEASUREMENT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /révéler la mesure/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Impossible de joindre le serveur. Réessayez.");

    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("[UC10] live flow creates the bench capture with source BENCH and reveals with that measurement id", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(OPEN_SESSION, 201))
      .mockResolvedValueOnce(jsonResponse(LOCKED_SESSION))
      .mockResolvedValueOnce(jsonResponse({ measurementId: MEASUREMENT_ID, state: "INIT" }, 201))
      .mockResolvedValueOnce(jsonResponse(result()));
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient deviceId={DEVICE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /initialiser le banc/i }));
    expect(await screen.findByText(/décrivez votre palpation/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /renforcement systolique rugueux/i }));
    fireEvent.click(screen.getByRole("button", { name: /intensité 4/i }));
    fireEvent.click(screen.getByRole("button", { name: /valider mon observation/i }));

    fireEvent.click(await screen.findByRole("button", { name: /lancer la capture/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const [sessionUrl] = fetchMock.mock.calls[0] ?? [];
    expect(String(sessionUrl)).toMatch(/\/bench\/sessions$/);
    const [palpationUrl] = fetchMock.mock.calls[1] ?? [];
    expect(String(palpationUrl)).toMatch(new RegExp(`/bench/sessions/${SESSION_ID}/palpation$`));

    const [createUrl, createInit] = fetchMock.mock.calls[2] ?? [];
    expect(String(createUrl)).toMatch(/\/measurements$/);
    expect(createInit).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      deviceId: DEVICE_ID,
      source: "BENCH",
    });

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toContain(`/ws/capture/${MEASUREMENT_ID}`);

    act(() => {
      if (!socket) return;
      socket.readyState = 1;
      socket.onopen?.();
    });
    expect(JSON.parse(String(socket?.sent[0]))).toEqual({
      type: "captureStart",
      measurementId: MEASUREMENT_ID,
    });

    act(() => {
      socket?.onmessage?.({
        data: JSON.stringify({
          type: "RESULT",
          result: { status: "NORMAL", rmsG: 0.094, peakFreqHz: 137, ratioHighLow: 1.42 },
        }),
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: /révéler la mesure/i }));

    expect(await screen.findByText("92 %")).toBeInTheDocument();
    expect(await screen.findByText("137 Hz")).toBeInTheDocument();

    const [revealUrl, revealInit] = fetchMock.mock.calls[3] ?? [];
    expect(String(revealUrl)).toMatch(new RegExp(`/bench/sessions/${SESSION_ID}/capture$`));
    expect(revealInit).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(revealInit?.body))).toEqual({ measurementId: MEASUREMENT_ID });
  });

  it("[UC11] the live reveal is never called before the palpation is saved", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient initialSession={OPEN_SESSION} deviceId={DEVICE_ID} />);

    expect(screen.queryByRole("button", { name: /lancer la capture/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /révéler la mesure/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /valider mon observation/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /valider mon observation/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("[UC10] a failed bench measurement creation shows the French error with Réessayer", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient initialSession={LOCKED_SESSION} deviceId={DEVICE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /lancer la capture/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Impossible de démarrer la capture. Réessayez.");

    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("[UC10] bench device id config: unset and non-UUID ids are rejected, a valid UUID is accepted", () => {
    expect(resolveBenchDeviceId(undefined)).toBeNull();
    expect(resolveBenchDeviceId(null)).toBeNull();
    expect(resolveBenchDeviceId("")).toBeNull();
    expect(resolveBenchDeviceId("dev-02-001")).toBeNull();
    expect(resolveBenchDeviceId("55555555-5555-4555-8555")).toBeNull();
    expect(resolveBenchDeviceId(` ${DEVICE_ID} `)).toBe(DEVICE_ID);
    expect(resolveBenchDeviceId(DEVICE_ID)).toBe(DEVICE_ID);
  });

  it("[UC10] an unconfigured bench device disables capture and sends no request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient initialSession={LOCKED_SESSION} deviceId={null} />);

    const captureButton = screen.getByRole("button", { name: /lancer la capture/i });
    expect(captureButton).toBeDisabled();
    expect(captureButton).toHaveAccessibleDescription(BENCH_DEVICE_CONFIG_ERROR);
    expect(screen.getByText(BENCH_DEVICE_CONFIG_ERROR)).toBeInTheDocument();

    fireEvent.click(captureButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("[UC10] an invalid bench device id disables capture and sends no request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<BenchClient initialSession={LOCKED_SESSION} deviceId="dev-02-001" />);

    const captureButton = screen.getByRole("button", { name: /lancer la capture/i });
    expect(captureButton).toBeDisabled();
    expect(screen.getByText(BENCH_DEVICE_CONFIG_ERROR)).toBeInTheDocument();

    fireEvent.click(captureButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("[UC10] a valid UUID bench device id enables capture", () => {
    render(<BenchClient initialSession={LOCKED_SESSION} deviceId={DEVICE_ID} />);

    expect(screen.getByRole("button", { name: /lancer la capture/i })).toBeEnabled();
    expect(screen.queryByText(BENCH_DEVICE_CONFIG_ERROR)).not.toBeInTheDocument();
  });

  it("[UC10] demo mode is labelled and carries the fixture bench values", async () => {
    render(<BenchClient demo />);

    expect(screen.getAllByText(/mode démonstration/i).length).toBeGreaterThan(0);
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getAllByText("mL/min").length).toBeGreaterThan(0);
  });
});
