"""Explainable AI behavior, trained only on non-clinical examples."""

import json

import numpy as np
import pytest

from dsfav_dsp.ai.classifier import (
    CLASS_LABELS,
    SYNTHETIC_DATA_LABEL,
    attach_ai_opinion,
    load_model,
    predict,
    train_classifier,
)
from dsfav_dsp.ai.features import FEATURE_NAMES, extract_features
from dsfav_dsp.ai.normality import compare_to_baseline
from dsfav_dsp.baseline import Baseline, Config
from dsfav_dsp.pipeline import process
from dsfav_dsp.synth import pressure_trace


def test_uc7_uc9_pipeline_rule_fields_match_with_ai_on_and_off():
    rows = np.array([[0.8, 90, 0.8, 12], [1.2, 120, 1.5, 18], [2.2, 190, 3.5, 32], [3.0, 260, 5.5, 48]], dtype=float)
    model = train_classifier(rows, np.array([0, 30, 50, 75]), seed=1)
    seconds = np.arange(25_000) / 1000
    adxl = np.column_stack([0.1 * np.sin(2 * np.pi * 45 * seconds), np.zeros_like(seconds), np.zeros_like(seconds)])
    lis = np.zeros((5_000, 3))
    pressure = pressure_trace(5.0)
    baseline = Baseline(rms=0.07, ratio=0.1, dominant_hz=45)
    plain = process(adxl, lis, pressure, 1000, 200, baseline, Config())
    enabled = process(adxl, lis, pressure, 1000, 200, baseline, Config(), ai_model=model)
    assert (plain.status, plain.deviation, plain.explanation) == (enabled.status, enabled.deviation, enabled.explanation)
    assert enabled.ai_opinion is not None
    assert set(enabled.ai_opinion["evidence"]) == {"features", "baselineValues", "topContributors"}
    assert plain.ai_opinion is None
    building = process(adxl, lis, pressure, 1000, 200, None, Config(), ai_model=model)
    assert building.status == "BASELINE_BUILDING"
    assert building.ai_opinion is None


def test_uc7_ai_features_include_spectral_width_and_evidence():
    sample_rate = 1000
    seconds = np.arange(sample_rate * 4) / sample_rate
    signal = np.sin(2 * np.pi * 45 * seconds) + 0.4 * np.sin(2 * np.pi * 180 * seconds)

    features = extract_features(signal, sample_rate)

    assert tuple(features) == FEATURE_NAMES
    assert set(features) == {"rms", "dominant_hz", "ratio", "spectral_width"}
    assert features["rms"] > 0
    assert features["dominant_hz"] == pytest.approx(45, abs=2)
    assert features["spectral_width"] > 0


def test_uc7_normality_returns_distance_and_top_feature_evidence():
    baseline = [
        {"rms": 1.0, "dominant_hz": 100.0, "ratio": 2.0, "spectral_width": 18.0},
        {"rms": 1.1, "dominant_hz": 102.0, "ratio": 2.1, "spectral_width": 19.0},
        {"rms": 0.9, "dominant_hz": 99.0, "ratio": 1.9, "spectral_width": 17.0},
    ]
    current = {"rms": 1.0, "dominant_hz": 100.0, "ratio": 4.0, "spectral_width": 18.0}

    opinion = compare_to_baseline(current, baseline)

    assert opinion.distance > 0
    assert opinion.top_features[0].name == "ratio"
    assert opinion.evidence["features"] == current
    assert opinion.evidence["baseline"] == baseline


def test_uc7_classifier_is_deterministic_and_records_synthetic_label(tmp_path):
    data = np.array(
        [
            [0.8, 90, 0.8, 12], [0.9, 94, 1.0, 14],
            [1.5, 130, 2.0, 22], [1.7, 134, 2.2, 24],
            [2.2, 190, 3.5, 32], [2.4, 194, 3.8, 35],
            [3.0, 260, 5.5, 48], [3.2, 264, 5.8, 51],
        ],
        dtype=float,
    )
    labels = np.array([0, 0, 30, 30, 50, 50, 75, 75])

    first = train_classifier(data, labels, seed=23)
    second = train_classifier(data, labels, seed=23)
    first_path = tmp_path / "ai-model.json"
    first.save(first_path)

    assert first.metrics == second.metrics
    assert np.array_equal(first.weights, second.weights)
    assert first.version
    assert first.training_data_label == SYNTHETIC_DATA_LABEL
    assert first.metrics["accuracy"] == 1.0
    assert json.loads(first_path.read_text(encoding="utf-8"))["version"] == first.version
    assert CLASS_LABELS == {0: "0", 30: "30", 50: "50", 75: "75"}


def test_uc7_classifier_reports_evidence_and_gracefully_disables_missing_model(tmp_path):
    assert load_model(tmp_path / "missing.json") is None

    model = train_classifier(
        np.array([[0.8, 90, 0.8, 12], [1.2, 120, 1.5, 18], [2.2, 190, 3.5, 32], [3.0, 260, 5.5, 48]], dtype=float),
        np.array([0, 30, 50, 75]),
        seed=1,
    )
    evidence = {name: 1.0 for name in FEATURE_NAMES}
    opinion = predict(model, evidence)

    assert opinion is not None
    assert opinion.evidence == evidence
    assert opinion.model_version == model.version
    assert opinion.training_data_label == "Données synthétiques, non cliniques"


def test_uc7_uc9_rule_status_is_byte_identical_with_ai_enabled_or_disabled():
    rows = np.array(
        [[0.8, 90, 0.8, 12], [1.2, 120, 1.5, 18], [2.2, 190, 3.5, 32], [3.0, 260, 5.5, 48]],
        dtype=float,
    )
    model = train_classifier(rows, np.array([0, 30, 50, 75]), seed=1)
    evidence = dict(zip(FEATURE_NAMES, rows[1].tolist(), strict=True))
    baseline = [evidence, {**evidence, "rms": 1.1}, {**evidence, "ratio": 1.6}]
    rule_result = {"status": "TO_CONFIRM", "deviation": 3.7, "explanation": "rule engine"}

    without_ai = attach_ai_opinion(rule_result, None, evidence, baseline)
    with_ai = attach_ai_opinion(rule_result, model, evidence, baseline)

    assert json.dumps({"status": without_ai["status"]}, separators=(",", ":")).encode() == json.dumps(
        {"status": with_ai["status"]}, separators=(",", ":")
    ).encode()
    assert without_ai["status"] == rule_result["status"]
    assert with_ai["aiOpinion"]["modelVersion"] == model.version
    assert with_ai["aiOpinion"]["evidence"]["features"] == evidence
    assert with_ai["aiOpinion"]["evidence"]["baseline"] == baseline
    assert with_ai["aiOpinion"]["trainingDataLabel"] == SYNTHETIC_DATA_LABEL


def test_uc7_ai_opinion_is_absent_while_baseline_is_building():
    rows = np.array(
        [[0.8, 90, 0.8, 12], [1.2, 120, 1.5, 18], [2.2, 190, 3.5, 32], [3.0, 260, 5.5, 48]],
        dtype=float,
    )
    model = train_classifier(rows, np.array([0, 30, 50, 75]), seed=1)
    evidence = dict(zip(FEATURE_NAMES, rows[1].tolist(), strict=True))
    rule_result = {"status": "BASELINE_BUILDING", "deviation": None}

    output = attach_ai_opinion(rule_result, model, evidence, [evidence, evidence, evidence])

    assert output == rule_result
    assert "aiOpinion" not in output


def test_uc7_missing_model_leaves_result_without_ai_output():
    evidence = {name: 1.0 for name in FEATURE_NAMES}
    rule_result = {"status": "NORMAL", "deviation": 0.4}

    output = attach_ai_opinion(
        rule_result,
        load_model("missing-ai-model.json"),
        evidence,
        [evidence, evidence, evidence],
    )

    assert output == rule_result
    assert "aiOpinion" not in output
