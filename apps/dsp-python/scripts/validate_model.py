"""Validate a trained explainable DSFAV model against held-out bench data."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from train import compute_evaluation_metrics, load_dataset

from dsfav_dsp.ai.classifier import load_model

DEFAULT_MIN_OVERALL_ACCURACY = 0.80
DEFAULT_MIN_CLASS_ACCURACY = 0.70


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True, help="Path to model JSON artifact")
    parser.add_argument("--csv", type=Path, required=True, help="Path to validation/held-out CSV")
    parser.add_argument("--label-column", default=None, help="Name of the clamp stenosis column")
    parser.add_argument(
        "--min-accuracy",
        type=float,
        default=DEFAULT_MIN_OVERALL_ACCURACY,
        help="Minimum required overall accuracy",
    )
    parser.add_argument(
        "--min-per-class-accuracy",
        type=float,
        default=DEFAULT_MIN_CLASS_ACCURACY,
        help="Minimum required per-class accuracy",
    )

    args = parser.parse_args(argv)

    model = load_model(args.model)
    if model is None:
        sys.stderr.write(f"Error: model at {args.model} could not be loaded or is invalid.\n")
        return 1

    try:
        features, labels, _ = load_dataset(args.csv, label_column=args.label_column)
    except ValueError as exc:
        sys.stderr.write(f"Error loading CSV: {exc}\n")
        return 1

    overall_acc, per_class_acc, confusion_mat = compute_evaluation_metrics(
        model.weights,
        model.bias,
        model.mean,
        model.scale,
        model.class_names,
        features,
        labels,
    )

    result_payload: dict[str, Any] = {
        "modelVersion": model.version,
        "trainingDataLabel": model.training_data_label,
        "accuracy": overall_acc,
        "per_class_accuracy": per_class_acc,
        "confusion_matrix": confusion_mat,
        "class_names": list(model.class_names),
        "numSamples": int(features.shape[0]),
        "minAccuracyTarget": args.min_accuracy,
        "minClassAccuracyTarget": args.min_per_class_accuracy,
    }

    # Evaluate against the acceptance bar
    reasons: list[str] = []
    if overall_acc < args.min_accuracy:
        reasons.append(
            f"Overall accuracy {overall_acc:.3f} below acceptance threshold {args.min_accuracy:.3f}"
        )

    for cls_name, cls_acc in per_class_acc.items():
        if cls_acc < args.min_per_class_accuracy:
            reasons.append(
                f"Class '{cls_name}' accuracy {cls_acc:.3f} below threshold {args.min_per_class_accuracy:.3f}"
            )

    if reasons:
        result_payload["passed"] = False
        result_payload["rejectionReasons"] = reasons
        sys.stderr.write("Model validation FAILED below acceptance bar:\n")
        for r in reasons:
            sys.stderr.write(f"  - {r}\n")
        print(json.dumps(result_payload, ensure_ascii=False, sort_keys=True, indent=2))
        return 1

    result_payload["passed"] = True
    print(json.dumps(result_payload, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
