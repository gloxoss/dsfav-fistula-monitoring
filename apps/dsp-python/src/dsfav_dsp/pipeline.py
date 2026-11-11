"""Main DSP pipeline orchestrating quality gate, filtering, feature extraction and scoring."""

from dataclasses import dataclass, replace

import numpy as np
from numpy.typing import NDArray

from dsfav_dsp.ai.classifier import LogisticModel, predict
from dsfav_dsp.ai.features import extract_features as extract_ai_features
from dsfav_dsp.baseline import Baseline, Config, score_against_baseline
from dsfav_dsp.features import extract_features
from dsfav_dsp.filters import bandpass_filter
from dsfav_dsp.gate import evaluate_gate

CLINICAL_DISCLAIMER: str = (
    "Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale."
)


@dataclass(frozen=True)
class Result:
    status: str
    reject_reason: str | None
    clean_seconds: float
    artifact_epochs: list[int]
    rms: float
    p2p: float
    dominant_hz: float
    ratio: float
    deviation: float | None
    top_feature: str | None
    top_change_pct: float | None
    stft: NDArray[np.float64]
    explanation: str
    disclaimer: str
    ai_opinion: dict[str, object] | None = None

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Result):
            return False
        return (
            self.status == other.status
            and self.reject_reason == other.reject_reason
            and self.clean_seconds == other.clean_seconds
            and self.artifact_epochs == other.artifact_epochs
            and bool(np.isclose(self.rms, other.rms))
            and bool(np.isclose(self.p2p, other.p2p))
            and bool(np.isclose(self.dominant_hz, other.dominant_hz))
            and bool(np.isclose(self.ratio, other.ratio))
            and (
                (self.deviation is None and other.deviation is None)
                or (
                    self.deviation is not None
                    and other.deviation is not None
                    and bool(np.isclose(self.deviation, other.deviation))
                )
            )
            and self.top_feature == other.top_feature
            and (
                (self.top_change_pct is None and other.top_change_pct is None)
                or (
                    self.top_change_pct is not None
                    and other.top_change_pct is not None
                    and bool(np.isclose(self.top_change_pct, other.top_change_pct))
                )
            )
            and np.array_equal(self.stft, other.stft)
            and self.explanation == other.explanation
            and self.disclaimer == other.disclaimer
        )


def process(
    adxl: NDArray[np.float64],
    lis: NDArray[np.float64],
    pressure: NDArray[np.float64],
    fs_adxl: int,
    fs_lis: int,
    baseline: Baseline | None,
    config: Config,
    gain: float = 1.0,
    ai_model: LogisticModel | None = None,
) -> Result:
    """Run the DSP pipeline; gain multiplies features by reference/device correction.

    The API passes ``1 / deviceGain``, where deviceGain is the device-to-reference
    reading ratio; a device reading 3.9% high therefore uses ``1 / 1.039``.
    """
    duration_s = float(len(adxl) / fs_adxl) if fs_adxl > 0 else 0.0

    # 1. Evaluate quality gate
    gate_result = evaluate_gate(lis, pressure, duration_s, fs_lis, config)

    # 2. Bandpass filter 15-450 Hz zero-phase Butterworth
    filtered = bandpass_filter(
        adxl,
        fs=fs_adxl,
        low_hz=config.filter_low_hz,
        high_hz=config.filter_high_hz,
    )

    # Short capture rejection (< 10 s)
    if duration_s < 10.0:
        features = extract_features(filtered, fs=fs_adxl, config=config, gain=gain)
        return Result(
            status="REJECTED_QUALITY",
            reject_reason="ARTIFACT",
            clean_seconds=0.0,
            artifact_epochs=[],
            rms=features.rms,
            p2p=features.p2p,
            dominant_hz=features.dominant_hz,
            ratio=features.ratio,
            deviation=None,
            top_feature=None,
            top_change_pct=None,
            stft=features.stft,
            explanation=gate_result.explanation,
            disclaimer=CLINICAL_DISCLAIMER,
        )

    # Rejection by quality gate (< 12 s clean time)
    if not gate_result.is_valid:
        if len(gate_result.clean_indices) > 0:
            clean_slices = [
                filtered[s * fs_adxl : (s + 1) * fs_adxl]
                for s in gate_result.clean_indices
            ]
            clean_filtered = np.concatenate(clean_slices)
            features = extract_features(clean_filtered, fs=fs_adxl, config=config, gain=gain)
        else:
            features = extract_features(filtered, fs=fs_adxl, config=config, gain=gain)

        return Result(
            status="REJECTED_QUALITY",
            reject_reason=gate_result.reject_reason,
            clean_seconds=gate_result.clean_seconds,
            artifact_epochs=gate_result.artifact_epochs,
            rms=features.rms,
            p2p=features.p2p,
            dominant_hz=features.dominant_hz,
            ratio=features.ratio,
            deviation=None,
            top_feature=None,
            top_change_pct=None,
            stft=features.stft,
            explanation=gate_result.explanation,
            disclaimer=CLINICAL_DISCLAIMER,
        )

    # 3. Clean signal extraction
    total_seconds = int(np.floor(duration_s))
    if len(gate_result.clean_indices) == total_seconds:
        clean_filtered = filtered
    else:
        clean_slices = [
            filtered[s * fs_adxl : (s + 1) * fs_adxl]
            for s in gate_result.clean_indices
        ]
        clean_filtered = np.concatenate(clean_slices)

    # 4. Feature extraction
    features = extract_features(clean_filtered, fs=fs_adxl, config=config, gain=gain)

    # 5. Baseline comparison
    status, deviation, top_feature, top_change_pct, explanation = score_against_baseline(
        rms=features.rms,
        ratio=features.ratio,
        dominant_hz=features.dominant_hz,
        baseline=baseline,
        config=config,
    )

    result = Result(
        status=status,
        reject_reason=None,
        clean_seconds=gate_result.clean_seconds,
        artifact_epochs=gate_result.artifact_epochs,
        rms=features.rms,
        p2p=features.p2p,
        dominant_hz=features.dominant_hz,
        ratio=features.ratio,
        deviation=deviation,
        top_feature=top_feature,
        top_change_pct=top_change_pct,
        stft=features.stft,
        explanation=explanation,
        disclaimer=CLINICAL_DISCLAIMER,
    )
    if ai_model is None or status == "BASELINE_BUILDING":
        return result
    ai_features = extract_ai_features(clean_filtered, fs_adxl)
    opinion = predict(ai_model, ai_features)
    if opinion is None:
        return result
    baseline_values = {
        "rms": baseline.rms,
        "ratio": baseline.ratio,
        "dominant_hz": baseline.dominant_hz,
    } if baseline is not None else {}
    contributors = [top_feature] if top_feature else []
    ai_opinion: dict[str, object] = {
        "level": opinion.level,
        "evidence": {
            "features": [{"name": name, "value": value} for name, value in opinion.evidence.items()],
            "baselineValues": [{"name": name, "value": value} for name, value in baseline_values.items()],
            "topContributors": contributors,
        },
        "modelVersion": opinion.model_version,
        "dataLabel": opinion.training_data_label,
    }
    return replace(result, ai_opinion=ai_opinion)
