"""FastAPI wrapper: parse the binary protocol payload, run the pipeline, serialize."""

import base64
import os
import struct
from dataclasses import fields
from typing import Any

import numpy as np
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from numpy.typing import NDArray
from pydantic import BaseModel, Field

from dsfav_dsp.ai.classifier import load_model
from dsfav_dsp.baseline import Baseline, Config
from dsfav_dsp.pipeline import Result, process

HEADER_STRUCT = struct.Struct("<4sHHHII")
HEADER_SIZE = HEADER_STRUCT.size
MAGIC = b"DSFV"
PROTOCOL_VERSION = 1
ADXL_LSB_PER_G = 16_384.0
LIS_LSB_PER_G = 1_024.0
PRESSURE_LSB_PER_KPA = 100.0
PRESSURE_FS_HZ = 10

app = FastAPI(title="DSFAV DSP")


def _invalid_request(field: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "code": "INVALID_REQUEST",
            "message_fr": message,
            "retryable": False,
            "field": field,
        },
    )


@app.exception_handler(RequestValidationError)
async def request_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Use the service's French error envelope for invalid JSON fields."""
    errors = exc.errors()
    location = errors[0].get("loc", ()) if errors else ()
    field = ".".join(str(part) for part in location if part != "body") or "request"
    return _invalid_request(field, f"Champ {field} manquant ou invalide")


class ProcessThrillRequest(BaseModel):
    """JSON envelope: binary header options, patient baseline, config and base64 payload."""

    header: dict[str, Any] = Field(default_factory=dict)
    baseline: dict[str, Any] | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    raw_b64: str
    ai_enabled: bool = False


def _build_config(values: dict[str, Any]) -> Config:
    allowed = {item.name for item in fields(Config)}
    unknown = sorted(set(values) - allowed)
    if unknown:
        raise ValueError(f"Clé de configuration inconnue : {unknown[0]}")
    try:
        return Config(**{name: float(value) for name, value in values.items()})
    except (TypeError, ValueError) as exc:
        raise ValueError("Configuration invalide") from exc


def _build_baseline(values: dict[str, Any] | None) -> Baseline | None:
    if values is None:
        return None
    allowed = {item.name for item in fields(Baseline)}
    unknown = sorted(set(values) - allowed)
    if unknown:
        raise ValueError(f"Clé de référence inconnue : {unknown[0]}")
    missing = sorted({"rms", "ratio", "dominant_hz"} - set(values))
    if missing:
        raise ValueError(f"Référence patient incomplète : {missing[0]} manquant")
    try:
        return Baseline(
            rms=float(values["rms"]),
            ratio=float(values["ratio"]),
            dominant_hz=float(values["dominant_hz"]),
            rms_std=_optional_float(values.get("rms_std")),
            ratio_std=_optional_float(values.get("ratio_std")),
            dominant_hz_std=_optional_float(values.get("dominant_hz_std")),
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("Référence patient invalide") from exc


def _optional_float(value: Any) -> float | None:
    return None if value is None else float(value)


def _decode_payload(
    raw: bytes,
) -> tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64], int, int]:
    """Decode the 18-byte protocol header and the int16 LE interleaved sensor body."""
    if len(raw) < HEADER_SIZE:
        raise ValueError("En-tête binaire incomplet")
    magic, version, fs_adxl, fs_lis, n_adxl, n_lis = HEADER_STRUCT.unpack_from(raw, 0)
    if magic != MAGIC:
        raise ValueError("Signature binaire invalide (DSFV attendu)")
    if version != PROTOCOL_VERSION:
        raise ValueError(f"Version de protocole non prise en charge : {version}")
    if fs_adxl == 0 or fs_lis == 0:
        raise ValueError("Fréquences d'échantillonnage invalides")

    adxl_bytes = n_adxl * 3 * 2
    lis_bytes = n_lis * 3 * 2
    pressure_count = n_adxl * PRESSURE_FS_HZ // fs_adxl
    expected = HEADER_SIZE + adxl_bytes + lis_bytes + pressure_count * 2
    if len(raw) != expected:
        raise ValueError(
            f"Taille binaire invalide : {len(raw)} octets reçus, {expected} attendus"
        )

    offset = HEADER_SIZE
    adxl = np.frombuffer(raw, dtype="<i2", count=n_adxl * 3, offset=offset).astype(np.float64)
    offset += adxl_bytes
    lis = np.frombuffer(raw, dtype="<i2", count=n_lis * 3, offset=offset).astype(np.float64)
    offset += lis_bytes
    pressure = np.frombuffer(
        raw, dtype="<i2", count=pressure_count, offset=offset
    ).astype(np.float64)

    return (
        adxl.reshape(n_adxl, 3) / ADXL_LSB_PER_G,
        lis.reshape(n_lis, 3) / LIS_LSB_PER_G,
        pressure / PRESSURE_LSB_PER_KPA,
        int(fs_adxl),
        int(fs_lis),
    )


def _serialize(result: Result) -> dict[str, Any]:
    payload = {
        "status": result.status,
        "reject_reason": result.reject_reason,
        "clean_seconds": result.clean_seconds,
        "artifact_epochs": result.artifact_epochs,
        "rms": result.rms,
        "p2p": result.p2p,
        "dominant_hz": result.dominant_hz,
        "ratio": result.ratio,
        "deviation": result.deviation,
        "top_feature": result.top_feature,
        "top_change_pct": result.top_change_pct,
        "stft": result.stft.tolist(),
        "explanation": result.explanation,
        "disclaimer": result.disclaimer,
    }
    if result.ai_opinion is not None:
        payload["aiOpinion"] = result.ai_opinion
    return payload


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "dsp"}


@app.post("/internal/v1/process-thrill", response_model=None)
def process_thrill(request: ProcessThrillRequest) -> dict[str, Any] | JSONResponse:
    try:
        raw = base64.b64decode(request.raw_b64, validate=True)
    except ValueError:
        return _invalid_request("raw_b64", "flux binaire base64 invalide")

    try:
        adxl, lis, pressure, fs_adxl, fs_lis = _decode_payload(raw)
    except (TypeError, ValueError) as exc:
        return _invalid_request("raw_b64", str(exc))

    try:
        baseline = _build_baseline(request.baseline)
    except (TypeError, ValueError) as exc:
        return _invalid_request("baseline", str(exc))

    try:
        config = _build_config(request.config)
    except (TypeError, ValueError) as exc:
        return _invalid_request("config", str(exc))

    try:
        device_gain = float(request.header.get("gain", 1.0))
    except (TypeError, ValueError):
        return _invalid_request("header.gain", "gain invalide")

    if device_gain <= 0.0:
        return _invalid_request("header.gain", "gain d'étalonnage invalide")

    result = process(
        adxl,
        lis,
        pressure,
        fs_adxl,
        fs_lis,
        baseline,
        config,
        gain=1.0 / device_gain,
        ai_model=load_model(os.environ["DSFAV_AI_MODEL_PATH"]) if request.ai_enabled and os.getenv("DSFAV_AI_MODEL_PATH") else None,
    )
    return _serialize(result)
