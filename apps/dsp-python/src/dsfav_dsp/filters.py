"""Bandpass filtering stage using SciPy SOS Butterworth."""

import numpy as np
from numpy.typing import NDArray
from scipy import signal


def bandpass_filter(
    adxl: NDArray[np.float64],
    fs: int,
    low_hz: float = 15.0,
    high_hz: float = 450.0,
    order: int = 4,
) -> NDArray[np.float64]:
    """Zero-phase Butterworth bandpass filter removing DC and high-frequency noise."""
    if adxl.ndim > 1:
        x = adxl[:, 0]
    else:
        x = adxl

    if len(x) == 0:
        return np.array([], dtype=np.float64)

    # Detrend / center
    centered = x - float(np.mean(x))

    # Guard against too-short signals for sosfiltfilt padlen
    nyquist = fs / 2.0
    safe_low = max(0.1, low_hz)
    safe_high = min(nyquist - 0.1, high_hz)
    if safe_low >= safe_high:
        return centered.astype(np.float64)

    sos = signal.butter(order, [safe_low, safe_high], btype="bandpass", fs=fs, output="sos")
    filtered = signal.sosfiltfilt(sos, centered)
    return np.asarray(filtered, dtype=np.float64)
