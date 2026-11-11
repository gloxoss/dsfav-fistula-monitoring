"""Deterministic telemetry scenarios for the virtual DSFAV device.

Each scenario produces a full 25 s capture with known features, built on the
dsp-python synthetic generator so DSP golden tests stay comparable.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
from dsfav_dsp.synth import motion_burst, pressure_trace, thrill

FS_ADXL = 1000
FS_LIS = 200
PRESSURE_HZ = 10

SCENARIO_NAMES: tuple[str, ...] = (
    "healthy",
    "mild",
    "moderate",
    "severe",
    "progressive_4_weeks",
    "normal",
    "stenotic",
    "low_pressure",
    "high_pressure",
    "motion_short",
    "motion_heavy",
    "drop",
    "battery_low",
    "battery_critical",
)

RMS_NORMAL_G = 0.145
RATIO_NORMAL = 0.32
F_LOW_NORMAL = 68.0
F_HIGH = 280.0
RMS_STENOTIC_G = 0.19
RATIO_STENOTIC = 0.85
F_LOW_STENOTIC = 55.0

SYNTHETIC_PRESETS: dict[str, tuple[float, float]] = {
    "healthy": (800.0, 0.0),
    "mild": (740.0, 25.0),
    "moderate": (650.0, 50.0),
    "severe": (540.0, 75.0),
    # The selected capture is week 4; use build_progressive_scenarios to get all weeks.
    "progressive_4_weeks": (540.0, 75.0),
}

PRESSURE_NORMAL_KPA = 5.4
PRESSURE_LOW_KPA = 1.8
PRESSURE_HIGH_KPA = 10.2

BATTERY_DEFAULT = 95
BATTERY_LOW = 17
BATTERY_CRITICAL = 12

DROP_AT_SEC = 14.0
MOTION_SHORT_START = 10.0
MOTION_SHORT_END = 12.0
MOTION_HEAVY_START = 5.0
MOTION_HEAVY_END = 20.0


@dataclass(frozen=True)
class Scenario:
    """One full virtual capture."""

    name: str
    adxl: npt.NDArray[np.float64]
    lis: npt.NDArray[np.float64]
    pressure_kpa: npt.NDArray[np.float64]
    battery_pct: int
    drop_at_sec: float | None = None

    @property
    def seconds(self) -> float:
        return float(self.adxl.shape[0]) / FS_ADXL


def build_scenario(
    name: str,
    *,
    seconds: float = 25.0,
    fs_adxl: int = FS_ADXL,
    fs_lis: int = FS_LIS,
    seed: int = 0,
) -> Scenario:
    """Build a scenario by name; accepts both snake_case and kebab-case names."""
    key = name.replace("-", "_")
    if key not in SCENARIO_NAMES:
        raise ValueError(f"unknown scenario: {name}")
    stenotic = key == "stenotic"
    flow, stenosis_pct = SYNTHETIC_PRESETS.get(
        key,
        (800.0, 0.0),
    )
    adxl = thrill(
        rms=RMS_STENOTIC_G if stenotic else RMS_NORMAL_G,
        ratio=RATIO_STENOTIC if stenotic else RATIO_NORMAL,
        f_low=F_LOW_STENOTIC if stenotic else F_LOW_NORMAL,
        f_high=F_HIGH,
        seconds=seconds,
        fs=fs_adxl,
        flow=flow,
        stenosis_pct=stenosis_pct,
        noise=0.005,
        seed=seed,
    )
    if key in ("motion_short", "motion_heavy"):
        if key == "motion_short":
            start, end = MOTION_SHORT_START, MOTION_SHORT_END
        else:
            start, end = MOTION_HEAVY_START, MOTION_HEAVY_END
        _, lis = motion_burst(start, end, seconds=seconds, fs_adxl=fs_adxl, fs_lis=fs_lis, seed=seed + 1)
    else:
        _, lis = motion_burst(seconds, seconds + 0.001, seconds=seconds + 1.0, fs_adxl=fs_adxl, fs_lis=fs_lis, seed=seed + 2)
        count = int(seconds * fs_lis)
        lis = lis[:count]
    if key == "low_pressure":
        kpa: float = PRESSURE_LOW_KPA
    elif key == "high_pressure":
        kpa = PRESSURE_HIGH_KPA
    else:
        kpa = PRESSURE_NORMAL_KPA
    pressure = pressure_trace(kpa, seconds=seconds, fs=PRESSURE_HZ)
    battery = BATTERY_DEFAULT
    if key == "battery_low":
        battery = BATTERY_LOW
    elif key == "battery_critical":
        battery = BATTERY_CRITICAL
    drop_at = DROP_AT_SEC if key == "drop" else None
    return Scenario(
        name=key,
        adxl=adxl,
        lis=lis,
        pressure_kpa=pressure,
        battery_pct=battery,
        drop_at_sec=drop_at,
    )


def build_progressive_scenarios(
    *,
    seconds: float = 25.0,
    fs_adxl: int = FS_ADXL,
    fs_lis: int = FS_LIS,
    seed: int = 0,
) -> tuple[Scenario, ...]:
    """Return four deterministic synthetic captures for a demo trend only."""
    return tuple(
        Scenario(
            name=f"progressive_week_{week}",
            adxl=thrill(
                rms=RMS_NORMAL_G,
                ratio=RATIO_NORMAL,
                f_low=F_LOW_NORMAL,
                f_high=F_HIGH,
                seconds=seconds,
                fs=fs_adxl,
                flow=flow,
                stenosis_pct=stenosis_pct,
                noise=0.005,
                seed=seed + week,
            ),
            lis=build_scenario("healthy", seconds=seconds, fs_adxl=fs_adxl, fs_lis=fs_lis, seed=seed + week).lis,
            pressure_kpa=pressure_trace(PRESSURE_NORMAL_KPA, seconds=seconds, fs=PRESSURE_HZ),
            battery_pct=BATTERY_DEFAULT,
        )
        for week, (flow, stenosis_pct) in enumerate(
            ((800.0, 0.0), (740.0, 25.0), (650.0, 50.0), (540.0, 75.0)),
            start=1,
        )
    )
