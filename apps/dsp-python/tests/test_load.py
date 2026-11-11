"""Concurrent load tests: 4 parallel uploads of 25 s golden payload against DSP."""

import base64
import concurrent.futures
import struct
import time
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from dsfav_dsp.api import app
from dsfav_dsp.pipeline import CLINICAL_DISCLAIMER
from dsfav_dsp.synth import thrill


def _build_25s_golden_payload() -> dict[str, Any]:
    """Build a valid 25-second golden capture payload matching the wire protocol."""
    n_adxl = 25_000  # 25 s at 1000 Hz
    n_lis = 5_000    # 25 s at 200 Hz
    fs_adxl = 1000
    fs_lis = 200

    header = struct.pack("<4sHHHII", b"DSFV", 1, fs_adxl, fs_lis, n_adxl, n_lis)

    # 25 s synthetic thrill
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=31)
    adxl_int16 = np.zeros((n_adxl, 3), dtype="<i2")
    adxl_int16[:, 0] = np.clip(signal[:, 0] * 16384.0, -32768, 32767).astype("<i2")
    adxl_int16[:, 1] = np.clip(signal[:, 1] * 16384.0, -32768, 32767).astype("<i2")
    adxl_int16[:, 2] = np.clip(signal[:, 2] * 16384.0, -32768, 32767).astype("<i2")
    adxl_bytes = adxl_int16.tobytes()

    lis_bytes = np.zeros((n_lis, 3), dtype="<i2").tobytes()
    pressure_count = n_adxl * 10 // fs_adxl
    pressure_bytes = np.full(pressure_count, 500, dtype="<i2").tobytes()

    raw = header + adxl_bytes + lis_bytes + pressure_bytes
    return {
        "header": {"gain": 1.0},
        "baseline": None,
        "config": {},
        "raw_b64": base64.b64encode(raw).decode("ascii"),
    }


@pytest.mark.perf
def test_load_four_parallel_uploads_under_1500_ms() -> None:
    """4 parallel uploads of the golden 25 s payload against the DSP must each finish under 1.5 s."""
    payload = _build_25s_golden_payload()
    concurrency = 4
    results: list[tuple[int, float, dict[str, Any]]] = []

    def _worker(worker_id: int) -> tuple[int, float, dict[str, Any]]:
        client = TestClient(app)
        start = time.perf_counter()
        response = client.post("/internal/v1/process-thrill", json=payload)
        elapsed = time.perf_counter() - start
        return worker_id, elapsed, response.json() if response.status_code == 200 else {"error": response.text, "status_code": response.status_code}

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(_worker, i) for i in range(concurrency)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    print("\n--- 4 PARALLEL DSP UPLOADS LOAD TEST RESULTS ---")
    for worker_id, elapsed, data in sorted(results, key=lambda x: x[0]):
        status = data.get("status", "UNKNOWN")
        print(f"Worker {worker_id}: {elapsed:.3f} s (status={status})")
        assert elapsed < 1.5, f"Worker {worker_id} took {elapsed:.3f} s, exceeds 1.5 s budget"
        assert data.get("disclaimer") == CLINICAL_DISCLAIMER
        assert status in ("BASELINE_BUILDING", "NORMAL", "TO_CONFIRM", "UNUSUAL_EVOLUTION")
