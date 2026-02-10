"""Video transcoding/remuxing service using FFmpeg."""

import asyncio
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Codecs the browser can play natively inside an MP4 container
BROWSER_VIDEO_CODECS = {'h264', 'h265', 'hevc', 'vp8', 'vp9', 'av1'}
BROWSER_AUDIO_CODECS = {'aac', 'mp3', 'opus', 'vorbis', 'flac'}

# Containers that browsers can play natively
BROWSER_NATIVE_CONTAINERS = {'.mp4', '.webm', '.m4v', '.ogg', '.ogv'}

# Containers that need remuxing or transcoding
NEEDS_PROCESSING_CONTAINERS = {'.mov', '.mkv', '.avi', '.flv', '.wmv', '.ts', '.mts', '.m2ts'}


class TranscodingService:
    def __init__(
        self,
        cache_dir: str,
        max_cache_size_mb: int = 2000,
        max_concurrent: int = 2,
        transcode_timeout: int = 3600,
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_cache_size_bytes = max_cache_size_mb * 1024 * 1024
        self.transcode_timeout = transcode_timeout
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._write_count = 0
        self._active_jobs: Dict[str, asyncio.Event] = {}

    def _get_cache_key(self, file_path: Path) -> str:
        stat = file_path.stat()
        key_data = f"{file_path}:{stat.st_mtime}:{stat.st_size}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _get_cache_path(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}.mp4"

    def get_cached_path(self, file_path: Path) -> Optional[Path]:
        cache_key = self._get_cache_key(file_path)
        cache_path = self._get_cache_path(cache_key)
        if cache_path.exists():
            os.utime(cache_path)
            return cache_path
        return None

    def needs_processing(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in NEEDS_PROCESSING_CONTAINERS

    async def probe_codecs(self, file_path: Path) -> Optional[Dict[str, Any]]:
        try:
            proc = await asyncio.create_subprocess_exec(
                'ffprobe', '-v', 'quiet',
                '-print_format', 'json',
                '-show_streams', '-show_format',
                str(file_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
            if proc.returncode != 0:
                return None
            data = json.loads(stdout)

            result: Dict[str, Any] = {
                'video_codec': None,
                'audio_codec': None,
                'container': file_path.suffix.lower(),
                'duration': None,
            }

            for stream in data.get('streams', []):
                codec = stream.get('codec_name', '').lower()
                if stream.get('codec_type') == 'video' and not result['video_codec']:
                    result['video_codec'] = codec
                elif stream.get('codec_type') == 'audio' and not result['audio_codec']:
                    result['audio_codec'] = codec

            fmt = data.get('format', {})
            if 'duration' in fmt:
                result['duration'] = float(fmt['duration'])

            return result
        except asyncio.TimeoutError:
            logger.warning("ffprobe timed out for %s", file_path.name)
            return None
        except FileNotFoundError:
            logger.warning("ffprobe not found - install ffmpeg")
            return None
        except Exception as e:
            logger.warning("ffprobe failed for %s: %s", file_path.name, e)
            return None

    async def get_or_create_mp4(self, file_path: Path) -> Optional[Path]:
        cached = self.get_cached_path(file_path)
        if cached:
            return cached

        cache_key = self._get_cache_key(file_path)
        cache_path = self._get_cache_path(cache_key)
        job_key = str(file_path)

        # If another request is already processing this file, wait for it
        if job_key in self._active_jobs:
            event = self._active_jobs[job_key]
            await event.wait()
            if cache_path.exists():
                return cache_path
            return None

        event = asyncio.Event()
        self._active_jobs[job_key] = event

        try:
            async with self._semaphore:
                # Re-check cache after acquiring semaphore
                if cache_path.exists():
                    return cache_path

                probe = await self.probe_codecs(file_path)
                if not probe:
                    logger.warning("Could not probe %s, attempting remux", file_path.name)
                    # Try remux anyway - ffmpeg may succeed where ffprobe failed
                    probe = {'video_codec': 'unknown', 'audio_codec': 'unknown'}

                video_ok = probe['video_codec'] in BROWSER_VIDEO_CODECS
                audio_ok = probe['audio_codec'] in BROWSER_AUDIO_CODECS or probe['audio_codec'] is None

                tmp_path = cache_path.with_suffix('.tmp.mp4')

                if video_ok and audio_ok:
                    logger.info("Remuxing %s (codecs: %s/%s)", file_path.name, probe['video_codec'], probe['audio_codec'])
                    success = await self._remux(file_path, tmp_path)
                else:
                    logger.info("Transcoding %s (codecs: %s/%s)", file_path.name, probe['video_codec'], probe['audio_codec'])
                    success = await self._transcode(file_path, tmp_path)

                if success and tmp_path.exists():
                    tmp_path.rename(cache_path)
                    self._write_count += 1
                    if self.max_cache_size_bytes and self._write_count % 10 == 0:
                        self._evict_if_needed()
                    logger.info("Cached %s → %s", file_path.name, cache_path.name)
                    return cache_path

                if tmp_path.exists():
                    tmp_path.unlink()
                return None
        finally:
            event.set()
            self._active_jobs.pop(job_key, None)

    async def _remux(self, source: Path, output: Path) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(
                'ffmpeg', '-y', '-i', str(source),
                '-c', 'copy',
                '-movflags', '+faststart',
                str(output),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            if proc.returncode != 0:
                logger.warning("Remux failed for %s: %s", source.name, stderr.decode()[-500:])
                return False
            return True
        except asyncio.TimeoutError:
            logger.warning("Remux timed out for %s", source.name)
            return False
        except Exception as e:
            logger.warning("Remux error for %s: %s", source.name, e)
            return False

    async def _transcode(self, source: Path, output: Path) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(
                'ffmpeg', '-y', '-i', str(source),
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-c:a', 'aac', '-b:a', '192k',
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
                str(output),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=self.transcode_timeout)
            if proc.returncode != 0:
                logger.warning("Transcode failed for %s: %s", source.name, stderr.decode()[-500:])
                return False
            return True
        except asyncio.TimeoutError:
            logger.warning("Transcode timed out for %s (limit: %ds)", source.name, self.transcode_timeout)
            return False
        except Exception as e:
            logger.warning("Transcode error for %s: %s", source.name, e)
            return False

    def _evict_if_needed(self):
        if not self.max_cache_size_bytes:
            return

        cache_files = list(self.cache_dir.glob("*.mp4"))
        if not cache_files:
            return

        total_size = sum(f.stat().st_size for f in cache_files)
        if total_size <= self.max_cache_size_bytes:
            return

        cache_files.sort(key=lambda f: f.stat().st_atime)

        evicted = 0
        for f in cache_files:
            if total_size <= self.max_cache_size_bytes:
                break
            fsize = f.stat().st_size
            f.unlink()
            total_size -= fsize
            evicted += 1

        if evicted:
            logger.info("Transcode cache eviction: removed %d files, cache now %.1f MB",
                        evicted, total_size / (1024 * 1024))
