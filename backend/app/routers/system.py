"""System information and real-time status endpoints."""

import asyncio
import logging
import os
import platform
import shutil
import socket
from pathlib import Path

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["system"])

_root_path: str | None = None
_thumb_cache_dir: str | None = None
_transcode_cache_dir: str | None = None


def init_services(root_path: str, thumb_cache_dir: str, transcode_cache_dir: str) -> None:
    global _root_path, _thumb_cache_dir, _transcode_cache_dir
    _root_path = root_path
    _thumb_cache_dir = thumb_cache_dir
    _transcode_cache_dir = transcode_cache_dir


def _get_cpu_name() -> str:
    """Best-effort CPU model name."""
    # /proc/cpuinfo (x86)
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    # lscpu fallback (works on ARM too)
    try:
        import subprocess
        out = subprocess.check_output(["lscpu"], text=True, timeout=5)
        for line in out.splitlines():
            if line.startswith("Model name:"):
                return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or "Unknown"


def _dir_size_bytes(path: str) -> int:
    """Total size of all files in a directory tree."""
    total = 0
    try:
        for dirpath, _dirnames, filenames in os.walk(path):
            for f in filenames:
                try:
                    total += os.path.getsize(os.path.join(dirpath, f))
                except OSError:
                    pass
    except OSError:
        pass
    return total


@router.get("/system/info")
async def get_system_info():
    """Static system info — fetched once by the frontend."""
    hostname = socket.gethostname()
    os_name = f"{platform.system()} {platform.release()}"

    # Disk info for root path
    disk_total_gb = None
    disk_used_gb = None
    if _root_path:
        try:
            usage = shutil.disk_usage(_root_path)
            disk_total_gb = round(usage.total / (1024 ** 3), 1)
            disk_used_gb = round(usage.used / (1024 ** 3), 1)
        except OSError:
            pass

    return {
        "hostname": hostname,
        "deviceType": platform.machine(),
        "osName": os_name,
        "cpuName": _get_cpu_name(),
        "diskTotalGb": disk_total_gb,
        "diskUsedGb": disk_used_gb,
        "rootPath": _root_path,
    }


@router.get("/system/status")
async def get_system_status():
    """Real-time metrics — polled every N seconds by the frontend."""

    def _collect():
        # CPU — read from /proc/stat (avoids psutil dependency)
        cpu_percent = _read_cpu_percent()

        # Memory
        mem = _read_meminfo()

        # Disk for root path
        disk_percent = None
        disk_used_gb = None
        disk_total_gb = None
        disk_available_gb = None
        if _root_path:
            try:
                usage = shutil.disk_usage(_root_path)
                disk_total_gb = round(usage.total / (1024 ** 3), 1)
                disk_used_gb = round(usage.used / (1024 ** 3), 1)
                disk_available_gb = round(usage.free / (1024 ** 3), 1)
                disk_percent = round((usage.used / usage.total) * 100, 1) if usage.total else 0
            except OSError:
                pass

        # Cache sizes
        thumb_cache_mb = round(_dir_size_bytes(_thumb_cache_dir) / (1024 ** 2), 1) if _thumb_cache_dir else 0
        transcode_cache_mb = round(_dir_size_bytes(_transcode_cache_dir) / (1024 ** 2), 1) if _transcode_cache_dir else 0

        return {
            "cpuPercent": cpu_percent,
            "memoryPercent": mem.get("percent", 0),
            "memoryUsedGb": mem.get("used_gb", 0),
            "memoryTotalGb": mem.get("total_gb", 0),
            "diskPercent": disk_percent,
            "diskUsedGb": disk_used_gb,
            "diskTotalGb": disk_total_gb,
            "diskAvailableGb": disk_available_gb,
            "thumbCacheMb": thumb_cache_mb,
            "transcodeCacheMb": transcode_cache_mb,
        }

    return await asyncio.to_thread(_collect)


# ─── Helpers (no psutil needed) ──────────────────────────────────────────────

_prev_idle = 0
_prev_total = 0


def _read_cpu_percent() -> float:
    """Compute CPU usage from /proc/stat delta."""
    global _prev_idle, _prev_total
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()
        # user, nice, system, idle, iowait, irq, softirq, steal
        values = [int(v) for v in parts[1:9]]
        idle = values[3] + values[4]  # idle + iowait
        total = sum(values)

        d_idle = idle - _prev_idle
        d_total = total - _prev_total
        _prev_idle = idle
        _prev_total = total

        if d_total == 0:
            return 0.0
        return round((1 - d_idle / d_total) * 100, 1)
    except Exception:
        return 0.0


def _read_meminfo() -> dict:
    """Parse /proc/meminfo for memory stats."""
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                key = parts[0].rstrip(":")
                info[key] = int(parts[1])  # kB

        total_kb = info.get("MemTotal", 0)
        available_kb = info.get("MemAvailable", 0)
        used_kb = total_kb - available_kb

        return {
            "total_gb": round(total_kb / (1024 ** 2), 1),
            "used_gb": round(used_kb / (1024 ** 2), 1),
            "percent": round((used_kb / total_kb) * 100, 1) if total_kb else 0,
        }
    except Exception:
        return {"total_gb": 0, "used_gb": 0, "percent": 0}
