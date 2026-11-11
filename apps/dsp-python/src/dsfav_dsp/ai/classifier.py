"""Small deterministic multinomial logistic model for labelled bench features."""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from dsfav_dsp.ai.features import FEATURE_NAMES, as_feature_vector

MODEL_VERSION = "dsfav-logreg-v1"
SYNTHETIC_DATA_LABEL = "Données synthétiques, non cliniques"
CLASS_LABELS = {0: "0", 30: "30", 50: "50", 75: "75"}
_CLASS_VALUES = tuple(CLASS_LABELS)
_CLASS_NAMES = tuple(CLASS_LABELS.values())


@dataclass(frozen=True)
class PredictionOpinion:
    level: str
    probabilities: dict[str, float]
    evidence: dict[str, float]
    model_version: str
    training_data_label: str


@dataclass(frozen=True)
class LogisticModel:
    version: str
    feature_names: tuple[str, ...]
    class_names: tuple[str, ...]
    mean: np.ndarray
    scale: np.ndarray
    weights: np.ndarray
    bias: np.ndarray
    metrics: dict[str, float]
    training_data_label: str

    def save(self, path: str | Path) -> None:
        """Persist all inference inputs and provenance in a readable artifact."""
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": self.version,
            "feature_names": list(self.feature_names),
            "class_names": list(self.class_names),
            "mean": self.mean.tolist(),
            "scale": self.scale.tolist(),
            "weights": self.weights.tolist(),
            "bias": self.bias.tolist(),
            "metrics": self.metrics,
            "training_data_label": self.training_data_label,
        }
        destination.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def train_classifier(
    features: np.ndarray,
    labels: np.ndarray,
    *,
    seed: int = 17,
    iterations: int = 2000,
    learning_rate: float = 0.1,
    regularization: float = 1e-4,
    training_data_label: str = SYNTHETIC_DATA_LABEL,
) -> LogisticModel:
    """Train full-batch softmax regression; input labels are bench clamp values."""
    x = np.asarray(features, dtype=np.float64)
    y_raw = np.asarray(labels)
    if x.ndim != 2 or x.shape[1] != len(FEATURE_NAMES) or x.shape[0] == 0:
        raise ValueError(f"features must have shape (n, {len(FEATURE_NAMES)})")
    if y_raw.ndim != 1 or y_raw.size != x.shape[0]:
        raise ValueError("labels must have one clamp value per feature row")
    if not np.all(np.isfinite(x)):
        raise ValueError("training features must be finite")
    try:
        y_values = y_raw.astype(np.int64)
    except (TypeError, ValueError) as exc:
        raise ValueError("clamp labels must be 0, 30, 50, or 75") from exc
    if not np.array_equal(y_raw, y_values) or not set(y_values.tolist()).issubset(_CLASS_VALUES):
        raise ValueError("clamp labels must be 0, 30, 50, or 75")
    if iterations < 1 or learning_rate <= 0 or regularization < 0:
        raise ValueError("training parameters must be positive (regularization may be zero)")
    if training_data_label != SYNTHETIC_DATA_LABEL:
        raise ValueError("only explicitly synthetic training data is enabled in this release")

    y = np.asarray([_CLASS_VALUES.index(int(value)) for value in y_values], dtype=np.int64)
    mean = np.mean(x, axis=0)
    scale = np.std(x, axis=0)
    scale = np.where(scale > 1e-12, scale, 1.0)
    normalized = (x - mean) / scale

    rng = np.random.default_rng(seed)
    weights = rng.normal(0.0, 0.01, size=(len(FEATURE_NAMES), len(_CLASS_NAMES)))
    bias = np.zeros(len(_CLASS_NAMES), dtype=np.float64)
    targets = np.eye(len(_CLASS_NAMES), dtype=np.float64)[y]
    for _ in range(iterations):
        logits = normalized @ weights + bias
        logits -= np.max(logits, axis=1, keepdims=True)
        exp_logits = np.exp(logits)
        probabilities = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
        error = (probabilities - targets) / x.shape[0]
        weights -= learning_rate * (normalized.T @ error + regularization * weights)
        bias -= learning_rate * np.sum(error, axis=0)

    final = normalized @ weights + bias
    final -= np.max(final, axis=1, keepdims=True)
    probabilities = np.exp(final)
    probabilities /= np.sum(probabilities, axis=1, keepdims=True)
    predictions = np.argmax(probabilities, axis=1)
    accuracy = float(np.mean(predictions == y))
    clipped = np.clip(probabilities[np.arange(y.size), y], 1e-15, 1.0)
    loss = float(-np.mean(np.log(clipped)))
    return LogisticModel(
        version=MODEL_VERSION,
        feature_names=FEATURE_NAMES,
        class_names=_CLASS_NAMES,
        mean=mean,
        scale=scale,
        weights=weights,
        bias=bias,
        metrics={"accuracy": accuracy, "cross_entropy": loss},
        training_data_label=training_data_label,
    )


def load_model(path: str | Path) -> LogisticModel | None:
    """Return None for absent or incompatible artifacts so callers can turn AI off."""
    try:
        payload: dict[str, Any] = json.loads(Path(path).read_text(encoding="utf-8"))
        if payload["version"] != MODEL_VERSION or payload["feature_names"] != list(FEATURE_NAMES):
            return None
        if payload["class_names"] != list(_CLASS_NAMES):
            return None
        model = LogisticModel(
            version=payload["version"],
            feature_names=tuple(payload["feature_names"]),
            class_names=tuple(payload["class_names"]),
            mean=np.asarray(payload["mean"], dtype=np.float64),
            scale=np.asarray(payload["scale"], dtype=np.float64),
            weights=np.asarray(payload["weights"], dtype=np.float64),
            bias=np.asarray(payload["bias"], dtype=np.float64),
            metrics={str(k): float(v) for k, v in payload["metrics"].items()},
            training_data_label=str(payload["training_data_label"]),
        )
        if model.training_data_label != SYNTHETIC_DATA_LABEL:
            return None
        if (
            model.mean.shape != (len(FEATURE_NAMES),)
            or model.scale.shape != (len(FEATURE_NAMES),)
            or model.weights.shape != (len(FEATURE_NAMES), len(_CLASS_NAMES))
            or model.bias.shape != (len(_CLASS_NAMES),)
            or not all(np.all(np.isfinite(array)) for array in (model.mean, model.scale, model.weights, model.bias))
            or np.any(model.scale <= 0)
        ):
            return None
        return model
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


def predict(model: LogisticModel | None, evidence: dict[str, float]) -> PredictionOpinion | None:
    """Return a labelled second opinion with the exact input feature evidence."""
    if model is None:
        return None
    vector = as_feature_vector(evidence)
    normalized = (vector - model.mean) / model.scale
    logits = normalized @ model.weights + model.bias
    logits -= np.max(logits)
    probabilities = np.exp(logits)
    probabilities /= np.sum(probabilities)
    return PredictionOpinion(
        level=model.class_names[int(np.argmax(probabilities))],
        probabilities={name: float(probabilities[i]) for i, name in enumerate(model.class_names)},
        evidence={name: float(evidence[name]) for name in FEATURE_NAMES},
        model_version=model.version,
        training_data_label=model.training_data_label,
    )


def attach_ai_opinion(
    rule_result: Mapping[str, object],
    model: LogisticModel | None,
    features: dict[str, float],
    baseline_values: Sequence[Mapping[str, float]],
) -> dict[str, object]:
    """Append an optional second opinion without changing any rule-result field."""
    output = dict(rule_result)
    if output.get("status") == "BASELINE_BUILDING" or model is None:
        return output

    opinion = predict(model, features)
    if opinion is None:
        return output
    evidence: dict[str, object] = {"features": opinion.evidence}
    evidence["baseline"] = [
        {name: float(row[name]) for name in FEATURE_NAMES} for row in baseline_values
    ]
    output["aiOpinion"] = {
        "level": opinion.level,
        "probabilities": opinion.probabilities,
        "evidence": evidence,
        "modelVersion": opinion.model_version,
        "trainingDataLabel": opinion.training_data_label,
    }
    return output
