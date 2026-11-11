"""Explainable distance from a patient's locked, valid-session baseline."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

import numpy as np

from dsfav_dsp.ai.features import FEATURE_NAMES, as_feature_vector

MAD_TO_SIGMA = 1.4826


@dataclass(frozen=True)
class FeatureContribution:
    name: str
    z_score: float
    contribution: float


@dataclass(frozen=True)
class NormalityOpinion:
    distance: float
    top_features: tuple[FeatureContribution, ...]
    evidence: dict[str, object]


def compare_to_baseline(
    current: Mapping[str, float],
    locked_baseline: Sequence[Mapping[str, float]],
    *,
    top_n: int = 3,
) -> NormalityOpinion:
    """Compare one session with baseline sessions using robust per-feature scales.

    The caller must provide only the patient's locked baseline. This function
    deliberately has no threshold or status output, so it cannot create alerts.
    """
    if len(locked_baseline) < 3:
        raise ValueError("a locked baseline requires at least three valid sessions")
    if top_n < 1:
        raise ValueError("top_n must be positive")

    observations = np.vstack([as_feature_vector(row) for row in locked_baseline])
    current_vector = as_feature_vector(current)
    medians = np.median(observations, axis=0)
    median_absolute_deviation = np.median(np.abs(observations - medians), axis=0)
    scales = MAD_TO_SIGMA * median_absolute_deviation
    # The small relative floor handles constant and near-zero features without
    # allowing division by zero; it does not establish a clinical cutoff.
    scales = np.maximum(scales, np.maximum(np.abs(medians) * 0.05, 1e-9))
    z_scores = (current_vector - medians) / scales
    squared = z_scores**2
    distance = float(np.sqrt(np.sum(squared)))
    order = np.argsort(-np.abs(z_scores), kind="stable")[:top_n]
    contributions = tuple(
        FeatureContribution(
            name=FEATURE_NAMES[int(index)],
            z_score=float(z_scores[index]),
            contribution=float(squared[index]),
        )
        for index in order
    )
    baseline_evidence = [
        {name: float(row[name]) for name in FEATURE_NAMES} for row in locked_baseline
    ]
    feature_evidence = {name: float(current[name]) for name in FEATURE_NAMES}
    return NormalityOpinion(
        distance=distance,
        top_features=contributions,
        evidence={"features": feature_evidence, "baseline": baseline_evidence},
    )
