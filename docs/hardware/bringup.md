# DSFAV hardware bring-up

This checklist covers technical bring-up only. Synthetic measurements establish protocol behavior, not clinical performance.

## H0: design review

- [ ] Confirm ESP32-C3 module, ADXL355, LIS2DW12, FSR, connector, and power BOM and exact part revisions.
- [ ] Resolve the flash question: the protocol plan assumes a 2 MB partition for up to eight raw sessions; verify the selected module's flash size and partition table before enabling offline capture.
- [ ] Confirm sensor bus addresses, voltage levels, grounding, and mechanical probe stack-up.
- [ ] Confirm Wi-Fi identity and token are provisioned at deployment; keep credentials out of firmware source and repository.

## H1: board and sensor smoke test

- [ ] Flash the ESP32-C3 board and confirm serial boot at 115200 baud.
- [ ] Confirm ADXL355 data-ready and 1 kHz sampling without dropped samples.
- [ ] Confirm LIS2DW12 200 Hz samples and stationary RMS behavior.
- [ ] Confirm FSR ADC response across its intended fixture range.
- [ ] Record board revision, firmware hash, sensor identity, and test date without patient information.

## H2: protocol and storage

- [ ] Check the 18-byte `DSFV` header against the protocol examples and verify all multi-byte values are little-endian.
- [ ] Verify payload ordering and sample counts for ADXL355, LIS2DW12, and 10 Hz FSR.
- [ ] Disconnect Wi-Fi, fill the eight-session buffer, and confirm further capture is blocked without replacing queued data.
- [ ] Reconnect and verify acknowledged sessions are removed only after successful idempotent synchronization.
- [ ] Confirm hello credentials arrive from provisioning and never appear in logs.

## H3: integrated bench check

- [ ] Verify device hello and capture flow against the API relay using a simulator or bench fixture.
- [ ] Confirm telemetry and preview rates, capture completion, and upload length against the protocol.
- [ ] Exercise power loss during capture and transfer; verify queued sessions remain intact.
- [ ] Record failures and corrective actions before any supervised clinical engineering review.

## Pressure calibration procedure

1. Use a traceable force/pressure reference and the production probe stack-up; do not use a patient.
2. Record raw ADC readings at no fewer than five points spanning the intended operating range, including increasing and decreasing force.
3. Fit and document the ADC-to-kPa conversion, repeatability, hysteresis, and uncertainty. Store calibration coefficients in device configuration, not source constants.
4. Verify the configured gates: below 2.5 kPa blocked; 2.5–3.0 amber; 3.0–8.5 green; 8.5–9.0 amber; above 9.0 blocked. Confirm 1.0 second of continuous valid pressure is required before capture.
5. Label these values as bench defaults pending calibration; retain the calibration record by device serial only.
