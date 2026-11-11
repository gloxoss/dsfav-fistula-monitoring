"""Command-line virtual DSFAV device.

Connects as a device to the API WebSocket, streams telemetry and preview,
waits for captureStart, generates the capture and uploads the raw payload.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from typing import Any

import httpx
import numpy as np
from websockets.asyncio.client import connect

from dsfav_sim.protocol import encode_raw
from dsfav_sim.scenarios import (
    FS_ADXL,
    FS_LIS,
    PRESSURE_HZ,
    SCENARIO_NAMES,
    Scenario,
    build_progressive_scenarios,
    build_scenario,
)

DEV_EMAIL_DOMAIN = "dsfav.local"
TELEMETRY_HZ = 10
PREVIEW_HZ = 25
DEFAULT_API = "http://localhost:3001"
DEFAULT_DEVICE = "DSFAV-UNIT-01"
DEFAULT_FW = "1.0.4"


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, sort_keys=True, ensure_ascii=False))


def hello_frame(device_id: str, fw: str, battery: int, token: str) -> str:
    return json.dumps(
        {
            "type": "hello",
            "deviceId": device_id,
            "serialNumber": device_id,
            "fw": fw,
            "battery": battery,
            "token": token,
        },
        sort_keys=True,
    )


def load_device_token(device_id: str) -> str:
    raw = os.environ.get("DEVICE_TOKENS")
    tokens: dict[str, str] = {}
    if raw:
        stripped = raw.strip()
        if stripped.startswith("{"):
            parsed = json.loads(stripped)
            if not isinstance(parsed, dict):
                raise ValueError("DEVICE_TOKENS JSON must be an object")
            tokens = {str(k): str(v) for k, v in parsed.items()}
        else:
            for pair in stripped.split(","):
                if "=" in pair:
                    key, value = pair.split("=", 1)
                    tokens[key.strip()] = value.strip()
    token = tokens.get(device_id)
    if not token:
        raise ValueError(
            "no device token found: set DEVICE_TOKENS as comma pairs (DEVICE_TOKENS=DSFAV-UNIT-01=<token>) "
            "or as a JSON object, with the dev seed values from apps/api-nestjs/prisma/seed.ts"
        )
    return token


def motion_rms_g(scenario: Scenario, second: float) -> float:
    index = round(second)
    chunk = scenario.lis[index * FS_LIS : (index + 1) * FS_LIS]
    if chunk.shape[0] == 0:
        norm = np.linalg.norm(scenario.lis[-FS_LIS:], axis=1)
    else:
        norm = np.linalg.norm(chunk, axis=1)
    return float(np.sqrt(np.mean(norm**2)))


def telemetry_frame(scenario: Scenario, second: float, battery: int) -> str:
    index = round(second)
    chunk = scenario.pressure_kpa[index * PRESSURE_HZ : (index + 1) * PRESSURE_HZ]
    kpa = float(np.mean(chunk)) if chunk.shape[0] else float(scenario.pressure_kpa[-1])
    return json.dumps(
        {
            "type": "telemetry",
            "pressureKpa": round(kpa, 3),
            "battery": battery,
            "motionG": round(motion_rms_g(scenario, second), 4),
            "timestamp": int(time.time() * 1000),
        },
        sort_keys=True,
    )


def preview_offsets(step: int) -> tuple[float, ...]:
    """Sub-tick offsets of the 25 Hz preview frames inside one 10 Hz telemetry tick."""
    if step < 0 or step >= TELEMETRY_HZ:
        raise ValueError(f"telemetry step must be in [0, {TELEMETRY_HZ})")
    return tuple(
        index / PREVIEW_HZ
        for index in range(PREVIEW_HZ)
        if (index * TELEMETRY_HZ) // PREVIEW_HZ == step
    )


def raw_upload_path(measurement_id: str | None) -> str:
    """Upload path for the raw payload; refuse to invent a measurement id."""
    if not measurement_id:
        raise ValueError("no measurementId: wait for captureStart before uploading the raw payload")
    return f"/measurements/{measurement_id}/raw"


def preview_frame(scenario: Scenario, second: float) -> str:
    adxl_start = round(second * FS_ADXL)
    lis_start = round(second * FS_LIS)
    per_preview_adxl = FS_ADXL // PREVIEW_HZ
    per_preview_lis = FS_LIS // PREVIEW_HZ
    adxl_chunk = scenario.adxl[adxl_start : adxl_start + per_preview_adxl]
    lis_chunk = scenario.lis[lis_start : lis_start + per_preview_lis]
    if adxl_chunk.shape[0] == 0:
        adxl_chunk = scenario.adxl[-per_preview_adxl:]
    if lis_chunk.shape[0] == 0:
        lis_chunk = scenario.lis[-per_preview_lis:]
    return json.dumps(
        {
            "type": "preview",
            "adxl": [int(word) for word in np.rint(ADXL_DEFAULT_SCALE * np.mean(np.abs(adxl_chunk), axis=1))],
            "lis": [int(word) for word in np.rint(LIS_DEFAULT_SCALE * np.mean(np.abs(lis_chunk), axis=1))],
            "timestamp": int(time.time() * 1000),
        },
        sort_keys=True,
    )


ADXL_DEFAULT_SCALE = 16384.0
LIS_DEFAULT_SCALE = 1024.0


async def login_and_create(
    client: httpx.AsyncClient,
    api_base: str,
    user: str,
    password: str,
    patient: str | None,
    device_id: str,
) -> tuple[str, str]:
    login_response = await client.post(
        "/auth/login",
        json={"email": f"{user}@{DEV_EMAIL_DOMAIN}", "password": password},
    )
    login_response.raise_for_status()
    user_token: str = login_response.json()["token"]
    devices_response = await client.get(
        "/devices",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    devices_response.raise_for_status()
    devices: list[dict[str, Any]] = devices_response.json() if isinstance(devices_response.json(), list) else devices_response.json().get("devices", [])
    match = next((d for d in devices if d.get("serialNumber") == device_id), None)
    if match is None:
        raise ValueError(f"device {device_id} not found in GET /devices")
    create_response = await client.post(
        "/measurements",
        json={"idPseudo": patient, "deviceId": match["id"], "source": "BENCH" if patient is None else "PATIENT"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    create_response.raise_for_status()
    measurement_id: str = create_response.json()["measurementId"]
    _emit({"type": "measurementCreated", "measurementId": measurement_id})
    return measurement_id, user_token


async def upload_raw(api_base: str, measurement_id: str | None, token: str, payload: bytes) -> dict[str, Any]:
    path = raw_upload_path(measurement_id)
    async with httpx.AsyncClient(base_url=api_base, timeout=30.0) as client:
        response = await client.put(
            path,
            content=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream"},
        )
        try:
            result: dict[str, Any] = response.json()
        except ValueError:
            result = {"status_code": response.status_code, "text": response.text}
        result.setdefault("status_code", response.status_code)
        return result


async def run_device(args: argparse.Namespace, scenario: Scenario, token: str) -> int:
    ws_base = args.api.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
    ws_url = f"{ws_base}/ws/device/{args.device}"
    measurement_id: str | None = None
    user_token: str = token
    if args.headless_capture:
        async with httpx.AsyncClient(base_url=args.api, timeout=30.0) as client:
            measurement_id, user_token = await login_and_create(
                client,
                args.api,
                args.user,
                args.password,
                args.patient,
                args.device,
            )
    async with connect(ws_url) as socket:
        await socket.send(hello_frame(args.device, args.fw, scenario.battery_pct, token))
        ack_raw = await socket.recv()
        ack = json.loads(str(ack_raw))
        _emit({"type": "helloAck", "status": ack.get("status"), "measurementId": measurement_id})
        total_seconds = int(scenario.seconds)
        capture_started = measurement_id is not None
        for second in range(total_seconds):
            if not capture_started:
                message = await socket.recv()
                started = json.loads(str(message))
                if started.get("type") != "captureStart":
                    raise ValueError(f"unexpected frame while waiting for captureStart: {started}")
                measurement_id = started.get("measurementId", measurement_id)
                capture_started = True
            for step in range(TELEMETRY_HZ):
                await socket.send(telemetry_frame(scenario, second + step / TELEMETRY_HZ, scenario.battery_pct))
                for offset in preview_offsets(step):
                    await socket.send(preview_frame(scenario, min(second + offset, scenario.seconds - 0.001)))
                elapsed = telemetry_interval(args.speed)
                if elapsed > 0:
                    await asyncio.sleep(elapsed)
            _emit({"type": "progress", "second": second + 1, "total": total_seconds})
            if scenario.drop_at_sec is not None and second + 1 >= scenario.drop_at_sec:
                _emit({"type": "connectionDropped", "at_sec": scenario.drop_at_sec})
                return 0
        _emit({"type": "captureDone", "measurementId": measurement_id})
        payload = encode_raw(scenario.adxl, scenario.lis, scenario.pressure_kpa)
        _emit({"type": "rawUpload", "measurementId": measurement_id, "raw_bytes": len(payload)})
        result = await upload_raw(args.api, measurement_id, user_token, payload)
        _emit(result)
    return 0


def telemetry_interval(speed: float) -> float:
    if speed <= 0:
        return 0.0
    return 1.0 / (TELEMETRY_HZ * speed)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dsfav-sim", description="Virtual DSFAV device")
    parser.add_argument("--device", default=DEFAULT_DEVICE)
    parser.add_argument("--scenario", default="normal")
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--fw", default=DEFAULT_FW)
    parser.add_argument("--speed", type=float, default=1.0, help=">1 accelerates, 0 disables pacing")
    parser.add_argument("--headless-capture", action="store_true", help="create the measurement via the REST API")
    parser.add_argument("--patient", default=None)
    parser.add_argument("--user", default="nurse")
    parser.add_argument("--password", default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def dry_run(args: argparse.Namespace, scenario: Scenario) -> int:
    try:
        token = load_device_token(args.device)
    except ValueError:
        token = "dev-token-simulated"
    _emit(json.loads(hello_frame(args.device, args.fw, scenario.battery_pct, token)))
    _emit({"type": "helloAck", "status": "READY", "simulated": True})
    for second in (0, scenario.seconds / 2, scenario.seconds - 1.0):
        _emit(json.loads(telemetry_frame(scenario, second, scenario.battery_pct)))
        _emit(json.loads(preview_frame(scenario, second + 0.25)))
    measurement_id = "00000000-0000-4000-8000-000000000000"
    if args.headless_capture:
        _emit(
            {
                "type": "measurementCreate",
                "simulated": True,
                "email": f"{args.user}@{DEV_EMAIL_DOMAIN}",
                "patient": args.patient,
                "measurementId": measurement_id,
            }
        )
    _emit({"type": "captureStart", "measurementId": measurement_id, "simulated": True})
    for second in range(0, int(scenario.seconds), 5):
        _emit(json.loads(telemetry_frame(scenario, second, scenario.battery_pct)))
    if scenario.drop_at_sec is not None:
        _emit({"type": "connectionDropped", "at_sec": scenario.drop_at_sec, "simulated": True})
        return 0
    _emit({"type": "captureDone", "measurementId": measurement_id, "simulated": True})
    payload = encode_raw(scenario.adxl, scenario.lis, scenario.pressure_kpa)
    _emit(
        {
            "type": "rawUpload",
            "measurementId": measurement_id,
            "raw_bytes": len(payload),
            "simulated": True,
        }
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.scenario.replace("-", "_") not in SCENARIO_NAMES:
        parser.error(f"unknown scenario: {args.scenario} (choices: {', '.join(SCENARIO_NAMES)})")
    args.scenario = args.scenario.replace("-", "_")
    if args.headless_capture and not args.password and not args.dry_run:
        parser.error("--password is required with --headless-capture")
    if args.dry_run:
        if args.scenario == "progressive_4_weeks":
            for week, scenario in enumerate(build_progressive_scenarios(), start=1):
                _emit({"type": "progressionWeek", "week": week, "scenario": scenario.name, "synthetic": True})
                dry_run(args, scenario)
            return 0
        return dry_run(args, build_scenario(args.scenario))
    setup_logging()
    token = load_device_token(args.device)
    if args.scenario == "progressive_4_weeks":
        for scenario in build_progressive_scenarios():
            result = asyncio.run(run_device(args, scenario, token))
            if result != 0:
                return result
        return 0
    return asyncio.run(run_device(args, build_scenario(args.scenario), token))


def run_cli() -> None:
    try:
        sys.exit(main())
    except (ValueError, OSError) as error:
        print(f"dsfav-sim: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    run_cli()
