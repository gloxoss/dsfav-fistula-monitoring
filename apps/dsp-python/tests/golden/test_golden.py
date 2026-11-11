"""Expected API: process(adxl, lis, pressure, fs_adxl, fs_lis, baseline: Baseline | None, config: Config, gain=1.0) -> Result dataclass (status, reject_reason, clean_seconds, artifact_epochs, rms, p2p, dominant_hz, ratio, deviation, top_feature, top_change_pct, stft, explanation, disclaimer)."""

import numpy as np
import pytest

from dsfav_dsp.pipeline import Baseline, Config, process
from dsfav_dsp.synth import motion_burst, pressure_trace, thrill


def _normal() -> np.ndarray:
    return thrill(0.145, 0.32, 68, 180, 25, seed=11)


def _baseline() -> Baseline:
    return Baseline(rms=0.145, ratio=0.32, dominant_hz=68.0)


def _config() -> Config:
    return Config(threshold=3.4)


def test_g1_uc1_uc6_normal_matches_baseline() -> None:
    signal = _normal()
    result = process(signal, np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, _baseline(), _config())
    assert result.rms == pytest.approx(0.145, rel=0.05)
    assert result.ratio == pytest.approx(0.32, rel=0.10)
    assert result.dominant_hz == pytest.approx(68, abs=2)
    assert result.deviation < 1
    assert result.status == "NORMAL"


def test_g2_uc6_stenotic_shift() -> None:
    signal = thrill(0.089, 1.44, 68, 184, 25, seed=12)
    result = process(signal, np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, _baseline(), _config())
    assert result.dominant_hz == pytest.approx(184, abs=3)
    assert result.ratio == pytest.approx(1.44, rel=0.10)
    assert result.deviation > _config().threshold


def test_g3_uc4_two_second_motion_burst() -> None:
    adxl, lis = motion_burst(10, 12, seed=13)
    result = process(_normal() + adxl, lis, pressure_trace(5.0), 1000, 200, _baseline(), _config())
    assert set(result.artifact_epochs) == {10, 11}
    assert result.clean_seconds == pytest.approx(23)
    assert result.status != "REJECTED_QUALITY"


def test_g4_uc4_heavy_motion_rejected() -> None:
    adxl, lis = motion_burst(5, 20, seed=14)
    result = process(_normal() + adxl, lis, pressure_trace(5.0), 1000, 200, _baseline(), _config())
    assert result.clean_seconds < 12
    assert result.status == "REJECTED_QUALITY"
    assert result.reject_reason == "ARTIFACT"


@pytest.mark.parametrize("kpa", [1.8, 10.2])
def test_g5_uc2_pressure_out_of_range(kpa: float) -> None:
    result = process(_normal(), np.zeros((5_000, 3)), pressure_trace(kpa), 1000, 200, _baseline(), _config())
    assert result.status == "REJECTED_QUALITY"
    assert result.reject_reason == "PRESSURE"
    assert str(kpa) in result.explanation


def test_g6_uc7_no_baseline_building_has_no_alert() -> None:
    result = process(_normal(), np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, None, _config())
    assert result.status == "BASELINE_BUILDING"
    assert result.deviation is None


def test_g7_uc9_threshold_equality_and_adjacent_values() -> None:
    # Derive the baseline from the measured feature vector so the ratio and
    # dominant-frequency z terms are exactly zero; dividing the RMS by the 5%
    # standard-deviation floor then puts the score exactly on the threshold.
    reference = process(_normal(), np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, None, _config())
    threshold_baseline = Baseline(
        rms=reference.rms / (1 + _config().threshold * _config().std_floor_pct),
        ratio=reference.ratio,
        dominant_hz=reference.dominant_hz,
    )
    results = [
        process(_normal(), np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, threshold_baseline, _config(), gain=gain)
        for gain in (1 - 1e-6, 1.0, 1 + 1e-6)
    ]
    assert results[0].deviation < _config().threshold
    assert results[1].deviation == pytest.approx(_config().threshold, abs=1e-9)
    assert results[1].status != "UNUSUAL_EVOLUTION"
    assert results[2].deviation > _config().threshold
    assert results[2].status == "TO_CONFIRM"


def test_g8_uc6_short_capture_refused() -> None:
    result = process(thrill(0.145, 0.32, 68, 180, 8, seed=15), np.zeros((1_600, 3)), pressure_trace(5.0, seconds=8), 1000, 200, None, _config())
    assert "signal trop court" in result.explanation.lower()


def test_g9_uc1_deterministic() -> None:
    args = (_normal(), np.zeros((5_000, 3)), pressure_trace(5.0), 1000, 200, _baseline(), _config())
    assert process(*args) == process(*args)
