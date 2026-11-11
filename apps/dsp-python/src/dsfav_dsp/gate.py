"""Quality gate evaluating duration, pressure validity, and motion artifacts."""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from dsfav_dsp.baseline import Config


@dataclass(frozen=True)
class GateResult:
    is_valid: bool
    reject_reason: str | None
    clean_seconds: float
    artifact_epochs: list[int]
    clean_indices: list[int]
    invalid_pressure_seconds: list[int]
    explanation: str


def evaluate_gate(
    lis: NDArray[np.float64],
    pressure: NDArray[np.float64],
    duration_s: float,
    fs_lis: int,
    config: Config,
) -> GateResult:
    """Evaluate duration, pressure and motion using aligned 1 s epochs.

    v1 uses aligned 1 s epochs (decision D-011); the canonical spec's 50 percent
    overlap is revisited with real bench data (M9).
    """
    total_seconds = int(np.floor(duration_s))

    if duration_s < 10.0 or total_seconds == 0:
        return GateResult(
            is_valid=False,
            reject_reason="ARTIFACT",
            clean_seconds=0.0,
            artifact_epochs=[],
            clean_indices=[],
            invalid_pressure_seconds=[],
            explanation="Signal trop court (< 10 s)",
        )

    # 1. Per-second pressure check
    fs_p = len(pressure) / duration_s if duration_s > 0 else 10.0
    invalid_pressure_seconds: list[int] = []

    for s in range(total_seconds):
        start_idx = round(s * fs_p)
        end_idx = round((s + 1) * fs_p)
        p_slice = pressure[start_idx:end_idx] if end_idx > start_idx else pressure[start_idx : start_idx + 1]

        if len(p_slice) == 0:
            val = float(pressure[min(s, len(pressure) - 1)]) if len(pressure) > 0 else 0.0
            p_valid = (config.pressure_min_kpa <= val <= config.pressure_max_kpa)
        else:
            p_valid = bool(np.all((p_slice >= config.pressure_min_kpa) & (p_slice <= config.pressure_max_kpa)))

        if not p_valid:
            invalid_pressure_seconds.append(s)

    # 2. Remove static gravity per axis, then evaluate aligned 1 s epochs.
    dirty_epoch_seconds: set[int] = set()
    static = np.median(lis, axis=0)
    dynamic = np.linalg.norm(lis - static, axis=1)

    for second in range(total_seconds):
        idx_start = second * fs_lis
        idx_end = min((second + 1) * fs_lis, len(dynamic))
        lis_slice = dynamic[idx_start:idx_end]

        if len(lis_slice) > 0:
            rms_motion = float(np.sqrt(np.mean(lis_slice**2)))
            if rms_motion > config.motion_g:
                dirty_epoch_seconds.add(second)

    artifact_epochs = sorted(dirty_epoch_seconds)

    # 3. Clean seconds: pressure valid AND no motion artifact
    clean_indices = [
        s for s in range(total_seconds)
        if (s not in invalid_pressure_seconds) and (s not in dirty_epoch_seconds)
    ]
    clean_seconds = float(len(clean_indices))

    # 4. Quality verdict
    if clean_seconds < config.min_clean_s:
        if len(invalid_pressure_seconds) > len(artifact_epochs):
            reject_reason = "PRESSURE"
            mean_p = float(np.mean(pressure)) if len(pressure) > 0 else 0.0
            if mean_p < config.pressure_min_kpa:
                explanation = f"Pression insuffisante ({mean_p:.1f} kPa < {config.pressure_min_kpa:.1f} kPa)"
            elif mean_p > config.pressure_max_kpa:
                explanation = f"Pression excessive ({mean_p:.1f} kPa > {config.pressure_max_kpa:.1f} kPa)"
            else:
                explanation = f"Pression instable ({mean_p:.1f} kPa hors plage)"
        else:
            reject_reason = "ARTIFACT"
            explanation = (
                f"Mouvements excessifs détectés ({len(artifact_epochs)} s d'artefacts, "
                f"{clean_seconds:.0f} s propres < {config.min_clean_s:.0f} s)"
            )

        return GateResult(
            is_valid=False,
            reject_reason=reject_reason,
            clean_seconds=clean_seconds,
            artifact_epochs=artifact_epochs,
            clean_indices=clean_indices,
            invalid_pressure_seconds=invalid_pressure_seconds,
            explanation=explanation,
        )

    return GateResult(
        is_valid=True,
        reject_reason=None,
        clean_seconds=clean_seconds,
        artifact_epochs=artifact_epochs,
        clean_indices=clean_indices,
        invalid_pressure_seconds=invalid_pressure_seconds,
        explanation="",
    )
