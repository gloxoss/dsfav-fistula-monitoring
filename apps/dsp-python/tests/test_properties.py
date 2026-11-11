"""Properties required by build plan §5."""

import numpy as np

from dsfav_dsp.pipeline import Config, process
from dsfav_dsp.synth import pressure_trace, thrill


def test_gain_scales_rms_but_preserves_ratio_and_frequency() -> None:
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=21)
    args = (np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, None, Config())
    plain = process(signal, *args)
    scaled = process(signal, *args, gain=1.7)
    np.testing.assert_allclose(scaled.rms, plain.rms * 1.7, rtol=0.02)
    np.testing.assert_allclose(scaled.ratio, plain.ratio, rtol=0.02)
    assert scaled.dominant_hz == plain.dominant_hz


def test_zero_padding_preserves_dominant_frequency() -> None:
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=22)
    padded = np.pad(signal, ((0, 25_000), (0, 0)))
    common = (np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, None, Config())
    assert process(signal, *common).dominant_hz == process(padded, *common).dominant_hz


def test_output_contains_no_nan() -> None:
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=23)
    result = process(signal, np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, None, Config())
    assert all(not np.isnan(value).any() for value in result.__dict__.values() if isinstance(value, np.ndarray))
