"""Deterministic synthetic inputs for DSP golden tests."""

from collections.abc import Sequence

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]
DEFAULT_FS = 1_000


def thrill(
    rms: float,
    ratio: float,
    f_low: float,
    f_high: float,
    seconds: float,
    fs: int = DEFAULT_FS,
    *,
    flow: float = 800.0,
    stenosis_pct: float = 0.0,
    noise: float = 0.001,
    seed: int = 0,
) -> FloatArray:
    """Generate an enveloped, parametric three-axis synthetic thrill.

    ``flow`` is in mL/min; amplitude scales with ``sqrt(flow / 800)``.
    Stenosis is a percent from 0 to 100: it multiplies the high/low band
    energy ratio by ``1 + 2 * stenosis_fraction`` and lowers ``f_low`` by up
    to 30%. ``noise`` is the Gaussian standard deviation as a fraction of the
    flow-adjusted RMS. These are demo-model choices, not clinical claims.
    """
    if rms <= 0 or ratio <= 0 or seconds <= 0 or fs <= 0:
        raise ValueError("rms, ratio, seconds and fs must be positive")
    if flow <= 0 or noise < 0 or not 0 <= stenosis_pct <= 100:
        raise ValueError("flow must be positive, noise non-negative, and stenosis_pct in [0, 100]")
    if f_low <= 0 or f_high <= f_low or f_high >= fs / 2:
        raise ValueError("frequencies must satisfy 0 < f_low < f_high < Nyquist")
    rng = np.random.default_rng(seed)
    count = round(seconds * fs)
    t = np.arange(count, dtype=np.float64) / fs
    envelope = 1.0 + 0.5 * np.sin(2 * np.pi * 1.2 * t)
    stenosis_fraction = stenosis_pct / 100.0
    target_rms = rms * np.sqrt(flow / 800.0)
    effective_ratio = ratio * (1.0 + 2.0 * stenosis_fraction)
    effective_f_low = f_low * (1.0 - 0.30 * stenosis_fraction)
    p_low = target_rms**2 / (1.0 + effective_ratio)
    p_high = target_rms**2 * effective_ratio / (1.0 + effective_ratio)
    a_low = np.sqrt(2.0 * p_low / 1.125)
    a_high = np.sqrt(2.0 * p_high / 1.125)
    wave = envelope * (
        a_low * np.sin(2 * np.pi * effective_f_low * t)
        + a_high * np.sin(2 * np.pi * f_high * t)
    )
    axes = np.column_stack((wave, 0.7 * wave, 0.4 * wave))
    return axes + rng.normal(0.0, target_rms * noise, axes.shape)


def motion_burst(
    start: float,
    end: float,
    *,
    seconds: float = 25.0,
    fs_adxl: int = 1_000,
    fs_lis: int = 200,
    seed: int = 0,
) -> tuple[FloatArray, FloatArray]:
    """Return low-noise ADXL and high-motion LIS arrays for the given interval."""
    if start < 0 or end <= start or end > seconds:
        raise ValueError("burst interval must lie within the capture")
    rng = np.random.default_rng(seed)
    adxl = rng.normal(0.0, 0.001, (int(seconds * fs_adxl), 3))
    lis = rng.normal(0.0, 0.005, (int(seconds * fs_lis), 3))
    first, last = int(start * fs_lis), int(end * fs_lis)
    t = np.arange(last - first, dtype=np.float64) / fs_lis
    lis[first:last, 0] += 0.18 * np.sin(2 * np.pi * 3.0 * t)
    lis[first:last, 1] += 0.11 * np.sin(2 * np.pi * 4.0 * t)
    lis[first:last, 2] += 0.08 * np.sin(2 * np.pi * 5.0 * t)
    return adxl, lis


def pressure_trace(
    kpa: float | Sequence[float],
    *,
    seconds: float = 25.0,
    fs: int = 10,
) -> FloatArray:
    """Expand a pressure value or one value per second into sampled pressure."""
    if seconds <= 0 or fs <= 0:
        raise ValueError("seconds and fs must be positive")
    values = np.asarray([kpa] if np.isscalar(kpa) else kpa, dtype=np.float64)
    if values.ndim != 1 or values.size == 0:
        raise ValueError("pressure must be a scalar or a non-empty one-dimensional sequence")
    count = round(seconds * fs)
    if values.size == 1:
        return np.full(count, values[0], dtype=np.float64)
    per_second = np.resize(values, int(np.ceil(seconds)))[: int(np.ceil(seconds))]
    return np.repeat(per_second, fs)[:count]
