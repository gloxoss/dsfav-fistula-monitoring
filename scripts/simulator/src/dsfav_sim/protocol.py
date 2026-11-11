"""Binary raw-upload codec for the DSFAV device protocol.

Layout per docs/protocol/device-protocol.md section 4:
18-byte little-endian header then int16 LE interleaved xyz payloads.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

HEADER_MAGIC = b"DSFV"
HEADER_SIZE = 18
HEADER_STRUCT = struct.Struct("<4sHHHII")

PROTOCOL_VERSION = 1
DEFAULT_FS_ADXL = 1000
DEFAULT_FS_LIS = 200
PRESSURE_HZ = 10

ADX_SCALE = 1.0 / 16384.0
LIS_SCALE = 1.0 / 1024.0
PRESSURE_CENTI_KPA = 0.01


@dataclass(frozen=True)
class RawPayload:
    """Decoded raw upload payload."""

    version: int
    fs_adxl: int
    fs_lis: int
    n_adxl: int
    n_lis: int
    adxl: npt.NDArray[np.float64]
    lis: npt.NDArray[np.float64]
    pressure_kpa: npt.NDArray[np.float64]

    @property
    def seconds(self) -> float:
        return self.n_adxl / self.fs_adxl


def _quantize(values: npt.NDArray[np.float64], scale: float) -> npt.NDArray[np.int16]:
    scaled = np.rint(values / scale)
    return np.clip(scaled, -32768, 32767).astype(np.int16)


def encode_raw(
    adxl: npt.NDArray[np.float64],
    lis: npt.NDArray[np.float64],
    pressure_kpa: npt.NDArray[np.float64],
    *,
    version: int = PROTOCOL_VERSION,
    fs_adxl: int = DEFAULT_FS_ADXL,
    fs_lis: int = DEFAULT_FS_LIS,
) -> bytes:
    """Encode one raw upload frame: header, adxl xyz, lis xyz, pressure centi-kPa."""
    adxl_arr = np.asarray(adxl, dtype=np.float64)
    lis_arr = np.asarray(lis, dtype=np.float64)
    pressure_arr = np.asarray(pressure_kpa, dtype=np.float64)
    if adxl_arr.ndim != 2 or adxl_arr.shape[1] != 3:
        raise ValueError("adxl must be a (n, 3) array of ADXL355 triplets")
    if lis_arr.ndim != 2 or lis_arr.shape[1] != 3:
        raise ValueError("lis must be a (n, 3) array of LIS2DW12 triplets")
    if pressure_arr.ndim != 1:
        raise ValueError("pressure_kpa must be a one-dimensional array at 10 Hz")
    n_adxl = adxl_arr.shape[0]
    n_lis = lis_arr.shape[0]
    if n_adxl == 0 or n_lis == 0:
        raise ValueError("adxl and lis sample counts must be positive")
    if n_adxl % fs_adxl != 0 or n_lis % fs_lis != 0:
        raise ValueError("sample counts must be whole seconds of their sample rate")
    n_pressure = n_adxl * PRESSURE_HZ // fs_adxl
    if pressure_arr.shape[0] != n_pressure:
        raise ValueError(f"pressure must hold {n_pressure} samples at 10 Hz")
    header = HEADER_STRUCT.pack(HEADER_MAGIC, version, fs_adxl, fs_lis, n_adxl, n_lis)
    adxl_block = _quantize(adxl_arr, ADX_SCALE)
    lis_block = _quantize(lis_arr, LIS_SCALE)
    pressure_block = _quantize(pressure_arr, PRESSURE_CENTI_KPA)
    return (
        header
        + adxl_block.astype("<i2", copy=False).tobytes()
        + lis_block.astype("<i2", copy=False).tobytes()
        + pressure_block.astype("<i2", copy=False).tobytes()
    )


def decode_raw(data: bytes | bytearray | memoryview) -> RawPayload:
    """Decode one raw upload frame back to float g and kPa values."""
    raw = bytes(data)
    if len(raw) < HEADER_SIZE:
        raise ValueError("payload shorter than the 18-byte DSFV header")
    magic, version, fs_adxl, fs_lis, n_adxl, n_lis = HEADER_STRUCT.unpack(raw[:HEADER_SIZE])
    if magic != HEADER_MAGIC:
        raise ValueError("bad magic bytes, expected DSFV")
    if fs_adxl <= 0 or fs_lis <= 0:
        raise ValueError("sample rates must be positive")
    n_pressure = n_adxl * PRESSURE_HZ // fs_adxl
    expected = HEADER_SIZE + (n_adxl + n_lis) * 6 + n_pressure * 2
    if len(raw) != expected:
        raise ValueError(f"payload length {len(raw)} does not match header counts, expected {expected}")
    adxl_block = np.frombuffer(raw, dtype="<i2", count=n_adxl * 3, offset=HEADER_SIZE)
    lis_offset = HEADER_SIZE + n_adxl * 6
    lis_block = np.frombuffer(raw, dtype="<i2", count=n_lis * 3, offset=lis_offset)
    pressure_offset = lis_offset + n_lis * 6
    pressure_block = np.frombuffer(raw, dtype="<i2", count=n_pressure, offset=pressure_offset)
    return RawPayload(
        version=version,
        fs_adxl=fs_adxl,
        fs_lis=fs_lis,
        n_adxl=n_adxl,
        n_lis=n_lis,
        adxl=adxl_block.reshape(n_adxl, 3).astype(np.float64) * ADX_SCALE,
        lis=lis_block.reshape(n_lis, 3).astype(np.float64) * LIS_SCALE,
        pressure_kpa=pressure_block.astype(np.float64) * PRESSURE_CENTI_KPA,
    )
