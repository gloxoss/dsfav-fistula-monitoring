"""HTTP contract tests for the internal DSP endpoint."""

import base64
import struct

import numpy as np
import pytest
from fastapi.testclient import TestClient

from dsfav_dsp.api import app
from dsfav_dsp.baseline import Baseline, Config
from dsfav_dsp.gate import evaluate_gate
from dsfav_dsp.pipeline import CLINICAL_DISCLAIMER, process
from dsfav_dsp.synth import pressure_trace, thrill

client = TestClient(app)


def _request_body() -> dict[str, object]:
    n_adxl = 12_000
    n_lis = 2_400
    header = struct.pack("<4sHHHII", b"DSFV", 1, 1000, 200, n_adxl, n_lis)
    adxl = np.zeros((n_adxl, 3), dtype="<i2").tobytes()
    lis = np.zeros((n_lis, 3), dtype="<i2").tobytes()
    pressure = np.full(120, 540, dtype="<i2").tobytes()
    raw = header + adxl + lis + pressure
    return {
        "header": {"gain": 1.0},
        "baseline": None,
        "config": {},
        "raw_b64": base64.b64encode(raw).decode("ascii"),
    }


def test_uc6_disclaimer_process_thrill_decodes_protocol_payload() -> None:
    response = client.post("/internal/v1/process-thrill", json=_request_body())

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "BASELINE_BUILDING"
    assert result["disclaimer"] == CLINICAL_DISCLAIMER


def test_g8_malformed_process_thrill_payload_has_french_error() -> None:
    response = client.post(
        "/internal/v1/process-thrill",
        json={"header": {}, "baseline": None, "config": {}, "raw_b64": "%%%"},
    )

    assert response.status_code == 422
    assert isinstance(response.json()["message_fr"], str)


def test_uc4_stationary_lis_gravity_offset_has_no_dirty_seconds() -> None:
    lis = np.tile([0.0, 0.0, 1.0], (5_000, 1))

    result = evaluate_gate(lis, pressure_trace(5.0), 25.0, 200, Config())

    assert result.artifact_epochs == []


def test_uc4_motion_burst_on_gravity_offset_masks_burst_seconds() -> None:
    lis = np.tile([0.0, 0.0, 1.0], (5_000, 1))
    lis[10 * 200 : 12 * 200, 0] = 0.5

    result = evaluate_gate(lis, pressure_trace(5.0), 25.0, 200, Config())

    assert result.artifact_epochs == [10, 11]
    assert result.clean_seconds == 23


def test_uc12_gain_multiplier_and_inverse_device_correction() -> None:
    device_gain = 1.039
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=31)
    common = (np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200)
    reference = process(signal, *common, None, Config())
    baseline = Baseline(reference.rms, reference.ratio, reference.dominant_hz)

    plain = process(signal, *common, baseline, Config(), gain=1.0)
    multiplied = process(signal, *common, baseline, Config(), gain=device_gain)
    corrected = process(signal * device_gain, *common, baseline, Config(), gain=1 / device_gain)

    assert multiplied.rms == pytest.approx(plain.rms * device_gain, abs=1e-6)
    assert corrected.rms == pytest.approx(plain.rms, abs=1e-6)
    assert corrected.deviation == pytest.approx(plain.deviation, abs=1e-6)


def test_uc1_missing_raw_b64_has_field_specific_error() -> None:
    response = client.post(
        "/internal/v1/process-thrill",
        json={"header": {}, "baseline": None, "config": {}},
    )

    assert response.status_code == 422
    assert response.json() == {
        "code": "INVALID_REQUEST",
        "message_fr": "Champ raw_b64 manquant ou invalide",
        "retryable": False,
        "field": "raw_b64",
    }


def test_uc1_wrong_header_magic_has_field_specific_error() -> None:
    body = _request_body()
    raw = bytearray(base64.b64decode(body["raw_b64"]))
    raw[:4] = b"NOPE"
    body["raw_b64"] = base64.b64encode(raw).decode("ascii")

    response = client.post("/internal/v1/process-thrill", json=body)

    assert response.status_code == 422
    assert response.json() == {
        "code": "INVALID_REQUEST",
        "message_fr": "Signature binaire invalide (DSFV attendu)",
        "retryable": False,
        "field": "raw_b64",
    }
