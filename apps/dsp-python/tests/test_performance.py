"""End-to-end DSP latency budget."""

import time

import numpy as np
import pytest

from dsfav_dsp.pipeline import Config, process
from dsfav_dsp.synth import pressure_trace, thrill


@pytest.mark.perf
def test_25_second_payload_under_1500_ms() -> None:
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=31)
    lis = np.zeros((5_000, 3))
    pressure = pressure_trace(5.0)
    started = time.perf_counter()
    process(signal, lis, pressure, 1000, 200, None, Config())
    assert time.perf_counter() - started < 1.5
