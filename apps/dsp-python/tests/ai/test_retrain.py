"""Tests for retraining path and model validation on non-clinical data."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from dsfav_dsp.ai.classifier import MODEL_VERSION, SYNTHETIC_DATA_LABEL


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _make_dummy_csv(path: Path, *, include_personal_data: str | None = None) -> None:
    headers = ["clamp_stenosis_pct", "rms", "dominant_hz", "ratio", "spectral_width"]
    if include_personal_data:
        headers.append(include_personal_data)

    rows = [
        # clamp 0
        [0, 0.145, 68.0, 0.32, 12.0],
        [0, 0.148, 67.5, 0.33, 12.2],
        # clamp 30
        [30, 0.160, 95.0, 0.55, 18.0],
        [30, 0.162, 94.0, 0.56, 18.5],
        # clamp 50
        [50, 0.190, 140.0, 0.85, 25.0],
        [50, 0.195, 142.0, 0.88, 26.0],
        # clamp 75
        [75, 0.240, 220.0, 1.45, 38.0],
        [75, 0.245, 225.0, 1.50, 40.0],
    ]

    with path.open("w", encoding="utf-8") as f:
        f.write(",".join(headers) + "\n")
        for row in rows:
            line = [str(x) for x in row]
            if include_personal_data:
                line.append("forbidden_val")
            f.write(",".join(line) + "\n")


def test_uc7_retrain_is_deterministic(tmp_path: Path) -> None:
    csv_file = tmp_path / "train.csv"
    _make_dummy_csv(csv_file)

    model_1 = tmp_path / "model1.json"
    metrics_1 = tmp_path / "metrics1.json"
    model_2 = tmp_path / "model2.json"
    metrics_2 = tmp_path / "metrics2.json"

    # Train twice with same seed
    cmd1 = [
        sys.executable,
        "scripts/train.py",
        "--csv",
        str(csv_file),
        "--output",
        str(model_1),
        "--metrics",
        str(metrics_1),
        "--seed",
        "42",
    ]
    res1 = subprocess.run(cmd1, capture_output=True, text=True, check=True)
    assert res1.returncode == 0

    cmd2 = [
        sys.executable,
        "scripts/train.py",
        "--csv",
        str(csv_file),
        "--output",
        str(model_2),
        "--metrics",
        str(metrics_2),
        "--seed",
        "42",
    ]
    res2 = subprocess.run(cmd2, capture_output=True, text=True, check=True)
    assert res2.returncode == 0

    # Byte-identical model hash
    assert _hash_file(model_1) == _hash_file(model_2)

    # Check metrics content
    metrics_data = json.loads(metrics_1.read_text(encoding="utf-8"))
    assert metrics_data["trainingDataLabel"] == SYNTHETIC_DATA_LABEL
    assert metrics_data["modelVersion"] == MODEL_VERSION
    assert "per_class_accuracy" in metrics_data
    assert "confusion_matrix" in metrics_data
    assert set(metrics_data["per_class_accuracy"].keys()) == {"0", "30", "50", "75"}


def test_uc7_retrain_rejects_personal_data_csv(tmp_path: Path) -> None:
    csv_with_cin = tmp_path / "personal_cin.csv"
    _make_dummy_csv(csv_with_cin, include_personal_data="patient_cin")

    out_model = tmp_path / "model.json"
    cmd = [
        sys.executable,
        "scripts/train.py",
        "--csv",
        str(csv_with_cin),
        "--output",
        str(out_model),
    ]
    res = subprocess.run(cmd, check=False, capture_output=True, text=True)
    assert res.returncode != 0
    assert "personnelle" in res.stderr.lower() or "personal" in res.stderr.lower()


def test_uc7_validate_model_fails_below_bar(tmp_path: Path) -> None:
    csv_file = tmp_path / "train.csv"
    _make_dummy_csv(csv_file)
    model_path = tmp_path / "model.json"

    # Train model
    subprocess.run(
        [
            sys.executable,
            "scripts/train.py",
            "--csv",
            str(csv_file),
            "--output",
            str(model_path),
            "--seed",
            "42",
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    # Validate with unreasonably high acceptance bar (e.g. 1.01 or held out mismatches)
    validate_cmd = [
        sys.executable,
        "scripts/validate_model.py",
        "--model",
        str(model_path),
        "--csv",
        str(csv_file),
        "--min-accuracy",
        "1.5",
    ]
    res = subprocess.run(validate_cmd, check=False, capture_output=True, text=True)
    assert res.returncode == 1


def test_uc7_validate_model_passes_above_bar(tmp_path: Path) -> None:
    csv_file = tmp_path / "train.csv"
    _make_dummy_csv(csv_file)
    model_path = tmp_path / "model.json"

    subprocess.run(
        [
            sys.executable,
            "scripts/train.py",
            "--csv",
            str(csv_file),
            "--output",
            str(model_path),
            "--seed",
            "42",
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    validate_cmd = [
        sys.executable,
        "scripts/validate_model.py",
        "--model",
        str(model_path),
        "--csv",
        str(csv_file),
        "--min-accuracy",
        "0.70",
    ]
    res = subprocess.run(validate_cmd, check=False, capture_output=True, text=True)
    assert res.returncode == 0
    data = json.loads(res.stdout)
    assert "accuracy" in data
