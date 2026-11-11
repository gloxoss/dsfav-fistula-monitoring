import numpy as np
import pytest

from dsfav_dsp.baseline import Baseline, Config
from dsfav_dsp.pipeline import process
from dsfav_dsp.synth import motion_burst, pressure_trace, thrill


def test_thrill_matches_requested_rms_and_band_ratio() -> None:
    signal = thrill(0.145, 0.32, 68, 180, 25, seed=7)
    assert signal.shape == (25_000, 3)
    centered = signal[:, 0] - signal[:, 0].mean()
    rms = float(np.sqrt(np.mean(centered**2)))
    frequencies = np.fft.rfftfreq(len(centered), d=1 / 1000)
    power = np.abs(np.fft.rfft(centered)) ** 2
    low = power[(frequencies >= 20) & (frequencies <= 80)].sum()
    high = power[(frequencies >= 100) & (frequencies <= 350)].sum()
    assert abs(rms / 0.145 - 1) <= 0.02
    assert abs((high / low) / 0.32 - 1) <= 0.05


def test_motion_burst_marks_lis_motion_over_threshold() -> None:
    adxl, lis = motion_burst(10, 12, seconds=25, seed=8)
    assert adxl.shape == (25_000, 3)
    assert lis.shape == (5_000, 3)
    assert np.sqrt(np.mean(lis[2_000:2_400] ** 2)) > 0.08


def test_pressure_trace_accepts_constant_and_per_second_values() -> None:
    assert pressure_trace(5.0).shape == (250,)
    trace = pressure_trace([2.0, 5.0], seconds=2)
    assert trace.shape == (20,)
    assert np.all(trace[:10] < 2.5)
    assert np.all(trace[10:] == 5.0)


def test_g1_healthy_preset_stays_normal_against_its_baseline() -> None:
    signal = thrill(0.145, 0.32, 68, 180, 25, flow=800, stenosis_pct=0, noise=0, seed=11)
    reference = process(signal, np.zeros((5_000, 3)), pressure_trace(5.4), 1000, 200, None, Config())
    baseline = Baseline(reference.rms, reference.ratio, reference.dominant_hz)

    result = process(signal, np.zeros((5_000, 3)), pressure_trace(5.4), 1000, 200, baseline, Config())

    assert result.status == "NORMAL"


def test_g2_stenosis_75_percent_raises_ratio_and_lowers_dominant_frequency() -> None:
    healthy = thrill(0.145, 0.32, 68, 180, 25, stenosis_pct=0, noise=0, seed=11)
    stenotic = thrill(0.145, 0.32, 68, 180, 25, stenosis_pct=75, noise=0, seed=11)
    clean_motion = np.zeros((5_000, 3))
    pressure = pressure_trace(5.4)
    reference = process(healthy, clean_motion, pressure, 1000, 200, None, Config())
    baseline = Baseline(reference.rms, reference.ratio, reference.dominant_hz)

    result = process(stenotic, clean_motion, pressure, 1000, 200, baseline, Config())

    assert result.ratio > reference.ratio
    assert result.dominant_hz < reference.dominant_hz


def test_uc9_progressive_four_week_scenario_escalates_after_two_abnormal_sessions() -> None:
    clean_motion = np.zeros((5_000, 3))
    pressure = pressure_trace(5.4)
    captures = [
        thrill(0.145, 0.32, 68, 180, 25, stenosis_pct=pct, noise=0, seed=11)
        for pct in (0, 40, 60, 75)
    ]
    baseline_result = process(captures[0], clean_motion, pressure, 1000, 200, None, Config())
    baseline = Baseline(baseline_result.rms, baseline_result.ratio, baseline_result.dominant_hz)
    statuses = [
        process(capture, clean_motion, pressure, 1000, 200, baseline, Config()).status
        for capture in captures[1:]
    ]
    escalated = [
        "UNUSUAL_EVOLUTION" if status == "TO_CONFIRM" and previous == "TO_CONFIRM" else status
        for previous, status in zip(("NORMAL", *statuses[:-1]), statuses, strict=True)
    ]

    assert statuses[0] == "TO_CONFIRM"
    assert escalated[1] == "UNUSUAL_EVOLUTION"


def test_synthetic_signal_is_deterministic_for_the_same_seed() -> None:
    kwargs = {
        "rms": 0.145,
        "ratio": 0.32,
        "f_low": 68,
        "f_high": 180,
        "seconds": 25,
        "flow": 760,
        "stenosis_pct": 35,
        "noise": 0.02,
        "seed": 27,
    }

    assert np.array_equal(thrill(**kwargs), thrill(**kwargs))


def test_flow_scales_synthetic_rms_by_square_root_of_relative_flow() -> None:
    common = {
        "rms": 0.145,
        "ratio": 0.32,
        "f_low": 68,
        "f_high": 180,
        "seconds": 25,
        "noise": 0,
        "seed": 17,
    }
    reference = thrill(**common, flow=800)[:, 0]
    lower_flow = thrill(**common, flow=400)[:, 0]
    reference_rms = float(np.sqrt(np.mean((reference - reference.mean()) ** 2)))
    lower_flow_rms = float(np.sqrt(np.mean((lower_flow - lower_flow.mean()) ** 2)))

    assert lower_flow_rms / reference_rms == pytest.approx(np.sqrt(0.5), rel=0.01)
