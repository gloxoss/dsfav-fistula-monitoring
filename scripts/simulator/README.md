# DSFAV virtual device simulator

Command-line virtual DSFAV unit (Python under uv). It speaks the device side of the
frozen contract `docs/protocol/device-protocol.md`: WebSocket `/ws/device/{id}` for
telemetry, preview and capture control, then one binary raw upload on
`PUT /measurements/{id}/raw`. Signals come from the local `dsfav_dsp` synthetic
generator, so the features of every scenario are known before the DSP runs.

## Install and run

```bash
cd scripts/simulator
uv sync
uv run dsfav-sim --device DSFAV-UNIT-01 --scenario normal --api http://localhost:3001
```

The device token is read from the `DEVICE_TOKENS` environment variable, either as
comma pairs or as a JSON object:

```bash
export DEVICE_TOKENS="DSFAV-UNIT-01=dev-token-unit-01,DSFAV-UNIT-02=dev-token-unit-02"
```

Dev-only seed values (tokens, clinical emails, password) live in
`apps/api-nestjs/prisma/seed.ts`; never invent or commit real credentials.
No password default exists in the CLI: pass `--password` for headless captures.

## Options

| Flag | Meaning |
|---|---|
| `--device` | device serial (`DSFAV-UNIT-01` by default) |
| `--scenario` | one of the scenarios below |
| `--api` | API base URL (`http://localhost:3001`) |
| `--fw` | simulated firmware version |
| `--speed` | stream acceleration factor, 0 disables pacing (live mode) |
| `--headless-capture` | create the measurement via the REST API instead of the web screen |
| `--patient PT-CAS-8841` | pseudonym used with `--headless-capture` |
| `--user nurse` | clinical email prefix (`<user>@dsfav.local`) |
| `--password` | required for `--headless-capture` in live mode (omitted in `--dry-run`), dev seed value only |
| `--dry-run` | print the frames and the upload payload summary without any network call |

`--dry-run` prints every frame as JSON lines and finishes with a `rawUpload`
summary holding `raw_bytes` (180518 octets for a 25 s capture). Use it against a
mock server workflow to check the protocol without any API running.

In `--dry-run` mode, headless capture can be simulated without credentials:

```bash
uv run dsfav-sim --device DSFAV-UNIT-01 --scenario normal \
  --headless-capture --patient PT-CAS-8841 --user nurse --dry-run
```

A headless live run creates the measurement itself:

```bash
uv run dsfav-sim --device DSFAV-UNIT-01 --scenario normal \
  --api http://localhost:3001 \
  --headless-capture --patient PT-CAS-8841 --user nurse --password <dev-seed>
```

## Scenarios

| Name | Effect on the telemetry |
|---|---|
| `normal` | baseline-shaped signal (RMS 0.145 g, ratio 0.32, dominant 68 Hz), pressure 5.4 kPa, battery 95 % |
| `stenotic` | shifted features (RMS 0.19 g, ratio 0.85, dominant 55 Hz) to exercise baseline alerts |
| `low-pressure` | constant 1.8 kPa, below the start gate |
| `high-pressure` | constant 10.2 kPa, above the compression risk limit |
| `motion-short` | two seconds of LIS motion covering the epochs 10-11 only |
| `motion-heavy` | fifteen seconds of LIS motion, clean time below the 12 s reject floor |
| `drop` | connection lost at 14 s; the payload stays in the offline buffer, nothing is uploaded |
| `battery-low` | battery at 17 %, warn zone |
| `battery-critical` | battery at 12 %, new capture must be refused |

Every scenario is a full 25 s capture at 1000 Hz (ADXL355) and 200 Hz
(LIS2DW12), 250 pressure samples at 10 Hz, encoded exactly per the binary
upload header (magic `DSFV`, version 1, int16 LE interleaved xyz,
1 g = 16384 LSB for ADXL, 1024 LSB for LIS, pressure in centi-kPa).

## Tests

```bash
cd scripts/simulator
uv run pytest
```

The suite covers the encoder round-trip within one LSB, the 18-bytes header
layout and total payload size, every scenario flag, the CLI dry-run output,
the 25 Hz preview cadence (25 preview frames per second, three or two per
telemetry tick), the mandatory `--password` with `--headless-capture` in live mode (and headless dry-run without credentials), and the
refusal to upload without a `measurementId` from `captureStart` (no invented
id). Test names carry the `dsfav-tdd` snake_case tags (`uc1`, `uc2`, `uc4`,
`uc6`, `uc13`, `g1`..`g5`, `no_loss`).
