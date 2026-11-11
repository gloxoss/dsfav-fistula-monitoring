"""Encoder, scenarios and CLI contract tests for T-s06 (virtual device).

Python test names cannot carry square brackets, so each tag is a whole
snake_case token (see the dsfav-tdd tag convention).
"""

import asyncio
import struct

import numpy as np
import numpy.typing as npt
import pytest
from dsfav_dsp.baseline import Config
from dsfav_dsp.pipeline import process
from dsfav_sim.protocol import (
    ADX_SCALE,
    HEADER_SIZE,
    LIS_SCALE,
    decode_raw,
    encode_raw,
)
from dsfav_sim.scenarios import build_scenario


def second_rms(lis: npt.NDArray[np.float64], samples_per_second: int = 200) -> list[float]:
    mag = np.linalg.norm(lis, axis=1)
    out = []
    for s in range(mag.shape[0] // samples_per_second):
        chunk = mag[s * samples_per_second : (s + 1) * samples_per_second]
        out.append(float(np.sqrt(np.mean(chunk**2))))
    return out


def band_energy_ratio(signal: npt.NDArray[np.float64], fs: float) -> float:
    spectrum = np.abs(np.fft.rfft(signal))
    freqs = np.fft.rfftfreq(signal.shape[0], d=1.0 / fs)
    high = float(np.sum(spectrum[(freqs >= 100) & (freqs <= 350)] ** 2))
    low = float(np.sum(spectrum[(freqs >= 20) & (freqs <= 80)] ** 2))
    return high / low


class TestEncoder:
    def test_uc1_encoder_round_trip_equals_input_within_1_lsb(self) -> None:
        rng = np.random.default_rng(7)
        adxl = rng.normal(0.0, 0.05, (25000, 3))
        lis = rng.normal(0.0, 0.02, (5000, 3))
        pressure = rng.uniform(1.5, 9.5, 250)
        payload = encode_raw(adxl, lis, pressure)
        decoded = decode_raw(payload)
        assert decoded.version == 1
        assert decoded.fs_adxl == 1000
        assert decoded.fs_lis == 200
        assert decoded.n_adxl == 25000
        assert decoded.n_lis == 5000
        assert np.allclose(decoded.adxl, adxl, atol=ADX_SCALE)
        assert np.allclose(decoded.lis, lis, atol=LIS_SCALE)
        assert np.allclose(decoded.pressure_kpa, pressure, atol=0.01)

    def test_uc1_encoder_header_magic_version_counts_and_total_size(self) -> None:
        payload = encode_raw(np.zeros((25000, 3)), np.zeros((5000, 3)), np.zeros(250))
        parsed = struct.unpack("<4sHHHII", payload[:HEADER_SIZE])
        assert HEADER_SIZE == 18
        assert parsed == (b"DSFV", 1, 1000, 200, 25000, 5000)
        assert len(payload) == 18 + 25000 * 3 * 2 + 5000 * 3 * 2 + 250 * 2
        assert len(payload) == 180518

    def test_uc1_real_scenario_payload_round_trips(self) -> None:
        scenario = build_scenario("normal")
        payload = encode_raw(scenario.adxl, scenario.lis, scenario.pressure_kpa)
        decoded = decode_raw(payload)
        assert np.allclose(decoded.adxl, scenario.adxl, atol=ADX_SCALE)
        assert np.allclose(decoded.lis, scenario.lis, atol=LIS_SCALE)
        assert np.allclose(decoded.pressure_kpa, scenario.pressure_kpa, atol=0.01)

    @pytest.mark.parametrize(
        ("adxl_shape", "lis_shape", "pressure_shape"),
        [
            ((24999, 3), (5000, 3), (250,)),
            ((25000, 3), (5000, 3), (249,)),
            ((25000, 2), (5000, 3), (250,)),
            ((25000, 3), (5000, 2), (250,)),
        ],
    )
    def test_uc1_encode_rejects_bad_shapes(
        self,
        adxl_shape: tuple[int, int],
        lis_shape: tuple[int, int],
        pressure_shape: tuple[int, ...],
    ) -> None:
        with pytest.raises(ValueError):
            encode_raw(np.zeros(adxl_shape), np.zeros(lis_shape), np.zeros(pressure_shape))

    def test_uc1_decode_rejects_bad_magic_and_short_payload(self) -> None:
        payload = encode_raw(np.zeros((25000, 3)), np.zeros((5000, 3)), np.zeros(250))
        bad_magic = b"XSFV" + payload[4:1000]
        truncated = payload[:17]
        with pytest.raises(ValueError):
            decode_raw(bad_magic)
        with pytest.raises(ValueError):
            decode_raw(truncated)

    def test_uc1_decode_rejects_count_mismatch(self) -> None:
        payload = encode_raw(np.zeros((25000, 3)), np.zeros((5000, 3)), np.zeros(250))
        edited = payload + b"\x00\x00"
        with pytest.raises(ValueError):
            decode_raw(edited)


class TestScenarios:
    def test_uc1_scenario_unknown_name_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_scenario("does_not_exist")

    def test_g1_uc1_scenario_normal_defaults_clean_motion_and_pressure_in_window(self) -> None:
        scenario = build_scenario("normal")
        assert scenario.drop_at_sec is None
        assert scenario.battery_pct >= 20
        rms_per_second = second_rms(scenario.lis)
        assert all(r <= 0.08 for r in rms_per_second)
        assert abs(float(np.mean(scenario.pressure_kpa)) - 5.4) < 0.01
        assert scenario.pressure_kpa.shape[0] == 250
        assert scenario.adxl.shape[0] == 25000
        assert scenario.lis.shape[0] == 5000

    def test_g5_uc2_scenario_low_pressure_1_8_kpa(self) -> None:
        scenario = build_scenario("low_pressure")
        assert abs(float(np.mean(scenario.pressure_kpa)) - 1.8) < 0.01
        assert float(np.max(scenario.pressure_kpa)) < 2.5

    def test_g5_uc2_scenario_high_pressure_10_2_kpa(self) -> None:
        scenario = build_scenario("high_pressure")
        assert abs(float(np.mean(scenario.pressure_kpa)) - 10.2) < 0.01
        assert float(np.min(scenario.pressure_kpa)) > 9.0

    def test_g3_uc4_scenario_motion_short_burst_only_between_10_and_12_seconds(self) -> None:
        scenario = build_scenario("motion_short")
        dirty = [i for i, r in enumerate(second_rms(scenario.lis)) if r > 0.08]
        assert dirty == [10, 11]

    def test_g4_uc4_scenario_motion_heavy_fifteen_seconds_of_motion(self) -> None:
        scenario = build_scenario("motion_heavy")
        per_second = second_rms(scenario.lis)
        dirty = [i for i, r in enumerate(per_second) if r > 0.08]
        assert len(dirty) >= 15
        assert all(r <= 0.08 for i, r in enumerate(per_second) if i not in dirty)

    def test_no_loss_scenario_drop_connection_at_14_seconds(self) -> None:
        scenario = build_scenario("drop")
        assert scenario.drop_at_sec == 14.0

    def test_uc13_scenario_battery_low_17_percent(self) -> None:
        assert build_scenario("battery_low").battery_pct == 17

    def test_uc13_scenario_battery_critical_12_percent(self) -> None:
        assert build_scenario("battery_critical").battery_pct == 12

    def test_g2_uc6_scenario_stenotic_shifts_features_from_normal(self) -> None:
        normal = build_scenario("normal")
        stenotic = build_scenario("stenotic")
        normal_miss = normal.adxl[:, 0]
        stenotic_miss = stenotic.adxl[:, 0]
        ratio_normal = band_energy_ratio(normal_miss, 1000.0)
        ratio_stenotic = band_energy_ratio(stenotic_miss, 1000.0)
        assert ratio_stenotic > ratio_normal * 1.5
        rms_normal = float(np.sqrt(np.mean(normal_miss**2)))
        rms_stenotic = float(np.sqrt(np.mean(stenotic_miss**2)))
        assert abs(rms_stenotic - rms_normal) > 0.2 * max(rms_normal, rms_stenotic)

    def test_g2_synthetic_severity_presets_raise_ratio_and_lower_peak_frequency(self) -> None:
        scenarios = [build_scenario(name) for name in ("healthy", "mild", "moderate", "severe")]
        ratios = [band_energy_ratio(scenario.adxl[:, 0], 1000.0) for scenario in scenarios]
        peaks = [
            process(
                scenario.adxl,
                scenario.lis,
                scenario.pressure_kpa,
                1000,
                200,
                None,
                Config(),
            ).dominant_hz
            for scenario in scenarios
        ]

        assert ratios == sorted(ratios)
        assert peaks == sorted(peaks, reverse=True)


def test_uc9_cli_progressive_four_weeks_emits_four_synthetic_captures(
    capsys: pytest.CaptureFixture[str],
) -> None:
    from dsfav_sim.cli import main

    code = main(["--scenario", "progressive-4-weeks", "--dry-run"])
    output = capsys.readouterr().out

    assert code == 0
    assert output.count('"type": "progressionWeek"') == 4
    assert output.count('"type": "rawUpload"') == 4


class TestCli:
    def test_uc1_cli_dry_run_prints_frames_and_upload_summary(
        self, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DEVICE_TOKENS", "DSFAV-UNIT-01=dev-token-unit-01")
        from dsfav_sim.cli import main

        code = main(
            [
                "--device",
                "DSFAV-UNIT-01",
                "--scenario",
                "normal",
                "--api",
                "http://localhost:3001",
                "--dry-run",
            ]
        )
        out = capsys.readouterr().out
        assert code == 0
        assert '"type": "hello"' in out
        assert '"type": "telemetry"' in out
        assert '"type": "preview"' in out
        assert "raw_bytes" in out

    def test_uc1_cli_dry_run_without_device_tokens_falls_back_to_simulated_token(
        self, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("DEVICE_TOKENS", raising=False)
        from dsfav_sim.cli import main

        code = main(["--device", "DSFAV-UNIT-01", "--scenario", "normal", "--dry-run"])
        out = capsys.readouterr().out
        assert code == 0
        assert '"token": "dev-token-simulated"' in out

    def test_uc1_cli_rejects_unknown_scenario(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from dsfav_sim.cli import main

        mock = monkeypatch.setattr
        mock("dsfav_sim.cli.setup_logging", lambda: None)
        with pytest.raises(SystemExit):
            main(
                [
                    "--device",
                    "DSFAV-UNIT-01",
                    "--scenario",
                    "bogus",
                    "--api",
                    "http://localhost:3001",
                    "--dry-run",
                ]
            )

    def test_uc1_cli_preview_cadence_is_25_hz(self) -> None:
        from dsfav_sim.cli import TELEMETRY_HZ, preview_offsets

        offsets = [offset for step in range(TELEMETRY_HZ) for offset in preview_offsets(step)]
        assert offsets == [index / 25 for index in range(25)]
        assert len(offsets) == 25
        assert all(0.0 <= offset < 1.0 for offset in offsets)

    def test_uc13_cli_headless_capture_requires_password_in_live_mode(self) -> None:
        from dsfav_sim.cli import main

        with pytest.raises(SystemExit):
            main(
                [
                    "--device",
                    "DSFAV-UNIT-01",
                    "--scenario",
                    "normal",
                    "--api",
                    "http://localhost:3001",
                    "--headless-capture",
                    "--patient",
                    "PT-CAS-8841",
                ]
            )

    def test_uc13_cli_headless_capture_dry_run_allows_missing_password(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        from dsfav_sim.cli import main

        code = main(
            [
                "--device",
                "DSFAV-UNIT-01",
                "--scenario",
                "normal",
                "--api",
                "http://localhost:3001",
                "--headless-capture",
                "--patient",
                "PT-CAS-8841",
                "--user",
                "nurse",
                "--dry-run",
            ]
        )
        out = capsys.readouterr().out
        assert code == 0
        assert '"type": "measurementCreate"' in out
        assert '"email": "nurse@dsfav.local"' in out
        assert '"patient": "PT-CAS-8841"' in out
        assert '"measurementId": "00000000-0000-4000-8000-000000000000"' in out
        assert '"type": "captureStart"' in out
        assert '"type": "rawUpload"' in out

    def test_uc1_cli_refuses_upload_without_measurement_id(self) -> None:
        from dsfav_sim.cli import raw_upload_path

        with pytest.raises(ValueError):
            raw_upload_path(None)
        assert raw_upload_path("m-1") == "/measurements/m-1/raw"

    def test_no_loss_cli_dry_run_drop_prints_no_raw_upload(
        self, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DEVICE_TOKENS", "DSFAV-UNIT-01=dev-token-unit-01")
        from dsfav_sim.cli import main

        code = main(["--device", "DSFAV-UNIT-01", "--scenario", "drop", "--dry-run"])
        out = capsys.readouterr().out
        assert code == 0
        assert '"type": "connectionDropped"' in out
        assert "raw_bytes" not in out


def test_uc1_upload_helper_signature_exists() -> None:
    from dsfav_sim.cli import upload_raw

    assert asyncio.iscoroutinefunction(upload_raw)
