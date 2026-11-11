"""Feature extraction stage (RMS, peak-to-peak, Welch dominant frequency, band ratio, STFT)."""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy import signal

from dsfav_dsp.baseline import Config


@dataclass(frozen=True)
class Features:
    rms: float
    p2p: float
    dominant_hz: float
    ratio: float
    stft: NDArray[np.float64]


def extract_features(
    filtered: NDArray[np.float64],
    fs: int,
    config: Config,
    gain: float = 1.0,
) -> Features:
    """Compute time and frequency domain features on clean filtered signal."""
    if len(filtered) == 0:
        return Features(
            rms=0.0,
            p2p=0.0,
            dominant_hz=0.0,
            ratio=0.0,
            stft=np.zeros((0, 0), dtype=np.float64),
        )

    # The caller supplies the correction factor (reference / device).
    rms = float(np.sqrt(np.mean(filtered**2)) * gain)
    p2p = float((np.percentile(filtered, 99) - np.percentile(filtered, 1)) * gain)

    # 2. Welch dominant frequency and band ratio (independent of scalar gain)
    nperseg_welch = min(1024, len(filtered))
    f_welch, psd = signal.welch(filtered, fs=fs, nperseg=nperseg_welch)

    if len(psd) > 0 and not np.all(psd == 0):
        dominant_hz = float(f_welch[np.argmax(psd)])
    else:
        dominant_hz = 0.0

    mask_low = (f_welch >= config.band_low_min_hz) & (f_welch <= config.band_low_max_hz)
    mask_high = (f_welch >= config.band_high_min_hz) & (f_welch <= config.band_high_max_hz)

    low_energy = float(np.trapezoid(psd[mask_low], f_welch[mask_low])) if np.any(mask_low) else 0.0
    high_energy = float(np.trapezoid(psd[mask_high], f_welch[mask_high])) if np.any(mask_high) else 0.0
    ratio = float(high_energy / low_energy) if low_energy > 0.0 else 0.0

    # 3. STFT (Hann 256, 75% overlap, <= 400 Hz, downsample time x4)
    nperseg_stft = min(256, len(filtered))
    noverlap_stft = int(0.75 * nperseg_stft)
    f_stft, _, zxx = signal.stft(
        filtered,
        fs=fs,
        window="hann",
        nperseg=nperseg_stft,
        noverlap=noverlap_stft,
    )
    mag_stft = np.abs(zxx)
    mask_freq = f_stft <= 400.0
    stft_downsampled = mag_stft[mask_freq, ::4]
    stft_clean = np.nan_to_num(stft_downsampled, copy=False).astype(np.float64)

    return Features(
        rms=rms,
        p2p=p2p,
        dominant_hz=dominant_hz,
        ratio=ratio,
        stft=stft_clean,
    )
