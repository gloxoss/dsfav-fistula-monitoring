"""Train the transparent DSFAV classifier from explicitly labelled CSV rows."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np

from dsfav_dsp.ai.classifier import (
    SYNTHETIC_DATA_LABEL,
    train_classifier,
)
from dsfav_dsp.ai.features import FEATURE_NAMES

PERSONAL_DATA_PATTERN = re.compile(
    r"(^|_)(name|nom|prenom|first_name|last_name|cin|birth|date_of_birth|naissance|phone|telephone|address|adresse|email|patient|id_patient)(_|$)",
    re.IGNORECASE,
)


def check_for_personal_data(headers: list[str]) -> None:
    for header in headers:
        normalized = header.strip().lower()
        if PERSONAL_DATA_PATTERN.search(normalized):
            raise ValueError(f"Donnée personnelle interdite détectée dans la colonne : '{header}'")


def load_dataset(
    csv_path: Path,
    label_column: str | None = None,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    with csv_path.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise ValueError("CSV is empty or lacks headers")

        headers = list(reader.fieldnames)
        check_for_personal_data(headers)

        # Detect label column
        if label_column and label_column in headers:
            chosen_label_col = label_column
        elif "clamp_stenosis_pct" in headers:
            chosen_label_col = "clamp_stenosis_pct"
        elif "clamp" in headers:
            chosen_label_col = "clamp"
        else:
            raise ValueError(
                f"Missing clamp label column (expected 'clamp_stenosis_pct' or 'clamp'). Available: {headers}"
            )

        missing_features = [f for f in FEATURE_NAMES if f not in headers]
        if missing_features:
            raise ValueError(f"Missing required feature columns: {missing_features}")

        rows = list(reader)
        if not rows:
            raise ValueError("CSV contains no data rows")

        features = np.asarray(
            [[float(row[name]) for name in FEATURE_NAMES] for row in rows], dtype=np.float64
        )
        labels = np.asarray([int(row[chosen_label_col]) for row in rows], dtype=np.int64)
        return features, labels, headers


def compute_evaluation_metrics(
    model_weights: np.ndarray,
    model_bias: np.ndarray,
    model_mean: np.ndarray,
    model_scale: np.ndarray,
    class_names: tuple[str, ...],
    features: np.ndarray,
    labels: np.ndarray,
) -> tuple[float, dict[str, float], list[list[int]]]:
    """Compute overall accuracy, per-class accuracy, and confusion matrix using numpy only."""
    norm_x = (features - model_mean) / model_scale
    logits = norm_x @ model_weights + model_bias
    logits -= np.max(logits, axis=1, keepdims=True)
    exp_logits = np.exp(logits)
    probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
    preds = np.argmax(probs, axis=1)

    class_indices = {int(name): idx for idx, name in enumerate(class_names)}
    y_true_indices = np.array([class_indices[int(lbl)] for lbl in labels], dtype=int)

    # Overall accuracy
    overall_accuracy = float(np.mean(preds == y_true_indices))

    # Confusion matrix: rows = true, cols = pred
    n_classes = len(class_names)
    matrix = [[0 for _ in range(n_classes)] for _ in range(n_classes)]
    for true_idx, pred_idx in zip(y_true_indices, preds, strict=True):
        matrix[true_idx][pred_idx] += 1

    # Per-class accuracy: class recall
    per_class_acc: dict[str, float] = {}
    for idx, name in enumerate(class_names):
        total_in_class = sum(matrix[idx])
        correct_in_class = matrix[idx][idx]
        per_class_acc[name] = float(correct_in_class / total_in_class) if total_in_class > 0 else 0.0

    return overall_accuracy, per_class_acc, matrix


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    # Support both --csv and positional for backwards compatibility
    parser.add_argument("--csv", dest="csv_path_opt", type=Path, help="CSV path with features and clamp column")
    parser.add_argument("csv_path_pos", nargs="?", type=Path, help="Positional CSV path")
    parser.add_argument("--output", dest="output_opt", type=Path, help="Output versioned model JSON")
    parser.add_argument("output_pos", nargs="?", type=Path, help="Positional output model JSON")
    parser.add_argument("--metrics", type=Path, help="Output metrics JSON path")
    parser.add_argument("--label-column", default=None, help="Clamp label column name")
    parser.add_argument("--seed", type=int, default=17, help="Random seed")
    parser.add_argument("--iterations", type=int, default=2000, help="Training iterations")
    parser.add_argument("--learning-rate", type=float, default=0.1, help="Learning rate")

    args = parser.parse_args(argv)

    csv_path = args.csv_path_opt or args.csv_path_pos
    if not csv_path:
        parser.error("A CSV input path is required via --csv <path> or as positional argument")

    output_path = args.output_opt or args.output_pos
    if not output_path:
        output_path = Path("apps/dsp-python/data/model.json")

    metrics_path = args.metrics or output_path.with_suffix(".metrics.json")

    try:
        features, labels, _ = load_dataset(csv_path, label_column=args.label_column)
    except ValueError as exc:
        sys.stderr.write(f"Error loading CSV: {exc}\n")
        return 2

    try:
        model = train_classifier(
            features,
            labels,
            seed=args.seed,
            iterations=args.iterations,
            learning_rate=args.learning_rate,
            training_data_label=SYNTHETIC_DATA_LABEL,
        )
    except ValueError as exc:
        sys.stderr.write(f"Training error: {exc}\n")
        return 1

    model.save(output_path)

    overall_acc, per_class_acc, confusion_mat = compute_evaluation_metrics(
        model.weights,
        model.bias,
        model.mean,
        model.scale,
        model.class_names,
        features,
        labels,
    )

    metrics_payload: dict[str, Any] = {
        "modelVersion": model.version,
        "trainingDataLabel": model.training_data_label,
        "overallAccuracy": overall_acc,
        "per_class_accuracy": per_class_acc,
        "confusion_matrix": confusion_mat,
        "class_names": list(model.class_names),
        "metrics": model.metrics,
        "numSamples": int(features.shape[0]),
    }

    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(
        json.dumps(metrics_payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "modelVersion": model.version,
                "trainingDataLabel": model.training_data_label,
                "accuracy": overall_acc,
                "per_class_accuracy": per_class_acc,
                "modelPath": str(output_path),
                "metricsPath": str(metrics_path),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
