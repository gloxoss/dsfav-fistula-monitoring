"""Named, reproducible features used by the optional learning layer."""

from collections.abc import Mapping

import numpy as np
from numpy.typing import ArrayLike
from scipy import signal

FEATURE_NAMES = ("rms", "dominant_hz", "ratio", "spectral_width")


def extract_features(samples: ArrayLike, sample_rate_hz: int) -> dict[str, float]:
    """Extract RMS, Welch peak, high/low band ratio, and spectral width."""
    values = np.asarray(samples, dtype=np.float64)
    if values.ndim != 1 or values.size < 2:
        raise ValueError("samples must be a one-dimensional signal with at least two values")
    if sample_rate_hz <= 0:
        raise ValueError("sample_rate_hz must be positive")
    if not np.all(np.isfinite(values)):
        raise ValueError("samples must be finite")

    centered = values - np.mean(values)
    frequencies, psd = signal.welch(
        centered, fs=sample_rate_hz, nperseg=min(1024, centered.size)
    )
    usable = (frequencies >= 15.0) & (frequencies <= min(450.0, sample_rate_hz / 2))
    if not np.any(usable):
        raise ValueError("sample rate has no usable spectrum in the DSFAV feature band")
    band_frequencies = frequencies[usable]
    band_psd = psd[usable]
    total_power = float(np.sum(band_psd))

    low_mask = (band_frequencies >= 20.0) & (band_frequencies <= 80.0)
    high_mask = (band_frequencies >= 100.0) & (band_frequencies <= 350.0)
    low_energy = float(np.trapezoid(band_psd[low_mask], band_frequencies[low_mask])) if np.any(low_mask) else 0.0
    high_energy = float(np.trapezoid(band_psd[high_mask], band_frequencies[high_mask])) if np.any(high_mask) else 0.0
    peak_index = int(np.argmax(band_psd))
    centroid = float(np.sum(band_frequencies * band_psd) / total_power) if total_power > 0 else 0.0
    spectral_width = (
        float(np.sqrt(np.sum(((band_frequencies - centroid) ** 2) * band_psd) / total_power))
        if total_power > 0
        else 0.0
    )

    return {
        "rms": float(np.sqrt(np.mean(centered**2))),
        "dominant_hz": float(band_frequencies[peak_index]),
        "ratio": float(high_energy / low_energy) if low_energy > 0 else 0.0,
        "spectral_width": spectral_width,
    }


def as_feature_vector(features: Mapping[str, float]) -> np.ndarray:
    """Return a finite vector in the canonical model feature order."""
    missing = [name for name in FEATURE_NAMES if name not in features]
    if missing:
        raise ValueError(f"missing AI features: {', '.join(missing)}")
    vector = np.asarray([features[name] for name in FEATURE_NAMES], dtype=np.float64)
    if not np.all(np.isfinite(vector)):
        raise ValueError("AI features must be finite")
    return vector
