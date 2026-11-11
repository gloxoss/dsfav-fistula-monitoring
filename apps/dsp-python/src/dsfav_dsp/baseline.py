"""Baseline scoring and threshold comparison."""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Baseline:
    rms: float
    ratio: float
    dominant_hz: float
    rms_std: float | None = None
    ratio_std: float | None = None
    dominant_hz_std: float | None = None


@dataclass(frozen=True)
class Config:
    threshold: float = 3.4
    min_clean_s: float = 12.0
    motion_g: float = 0.08
    pressure_min_kpa: float = 2.5
    pressure_max_kpa: float = 9.0
    filter_low_hz: float = 15.0
    filter_high_hz: float = 450.0
    band_low_min_hz: float = 20.0
    band_low_max_hz: float = 80.0
    band_high_min_hz: float = 100.0
    band_high_max_hz: float = 350.0
    std_floor_pct: float = 0.05


def score_against_baseline(
    rms: float,
    ratio: float,
    dominant_hz: float,
    baseline: Baseline | None,
    config: Config,
) -> tuple[str, float | None, str | None, float | None, str]:
    """Calculate z-score distance against baseline vector with standard deviation floor."""
    if baseline is None:
        return (
            "BASELINE_BUILDING",
            None,
            None,
            None,
            "Constitution de la référence patient en cours (aucune alerte)",
        )

    # 5% floor on standard deviation prevents zero-division and excessive sensitivity
    std_floor_pct = config.std_floor_pct
    sigma_rms = max(
        baseline.rms_std if baseline.rms_std is not None else 0.0,
        std_floor_pct * baseline.rms,
    )
    sigma_ratio = max(
        baseline.ratio_std if baseline.ratio_std is not None else 0.0,
        std_floor_pct * baseline.ratio,
    )
    sigma_fpeak = max(
        baseline.dominant_hz_std if baseline.dominant_hz_std is not None else 0.0,
        std_floor_pct * baseline.dominant_hz,
    )

    z_rms = (rms - baseline.rms) / sigma_rms
    z_ratio = (ratio - baseline.ratio) / sigma_ratio
    z_fpeak = (dominant_hz - baseline.dominant_hz) / sigma_fpeak

    deviation = float(np.sqrt(z_rms**2 + z_ratio**2 + z_fpeak**2))

    # Top feature and % change
    changes = {
        "rms": (((rms - baseline.rms) / baseline.rms) * 100.0, z_rms),
        "ratio": (((ratio - baseline.ratio) / baseline.ratio) * 100.0, z_ratio),
        "dominant_hz": (((dominant_hz - baseline.dominant_hz) / baseline.dominant_hz) * 100.0, z_fpeak),
    }
    top_feature = max(changes.keys(), key=lambda k: abs(changes[k][1]))
    top_change_pct = float(changes[top_feature][0])

    # Equality is not above threshold
    if deviation > config.threshold:
        status = "TO_CONFIRM"
        explanation = (
            f"Évolution à confirmer : écart ({deviation:.2f}) supérieur au seuil ({config.threshold:.1f}). "
            f"Principale variation : {top_feature} ({top_change_pct:+.1f}%)."
        )
    else:
        status = "NORMAL"
        explanation = (
            f"Mesure correcte : écart ({deviation:.2f}) dans les limites normales (seuil: {config.threshold:.1f}). "
            f"Principale variation : {top_feature} ({top_change_pct:+.1f}%)."
        )

    return status, deviation, top_feature, top_change_pct, explanation
