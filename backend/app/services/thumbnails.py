import hashlib
import subprocess
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
import io


class ThumbnailService:
    def __init__(self, cache_dir: str, sizes: dict, quality: int = 85):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.sizes = sizes
        self.quality = quality

    def _get_cache_key(self, file_path: Path, size: str) -> str:
        stat = file_path.stat()
        key_data = f"{file_path}:{stat.st_mtime}:{stat.st_size}:{size}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _get_cache_path(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}.jpg"

    def get_image_dimensions(self, file_path: Path) -> Tuple[int, int]:
        try:
            with Image.open(file_path) as img:
                return img.size
        except Exception:
            return (0, 0)

    async def get_thumbnail(self, file_path: Path, size: str = "thumb") -> Optional[bytes]:
        if not file_path.exists():
            return None

        target_size = self.sizes.get(size, 256)
        cache_key = self._get_cache_key(file_path, size)
        cache_path = self._get_cache_path(cache_key)

        if cache_path.exists():
            return cache_path.read_bytes()

        suffix = file_path.suffix.lower()

        if suffix in ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff']:
            thumb_bytes = await self._generate_image_thumbnail(file_path, target_size)
        elif suffix in ['.gif']:
            thumb_bytes = await self._generate_gif_thumbnail(file_path, target_size)
        elif suffix in ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v']:
            thumb_bytes = await self._generate_video_thumbnail(file_path, target_size)
        else:
            return None

        if thumb_bytes:
            cache_path.write_bytes(thumb_bytes)

        return thumb_bytes

    async def _generate_image_thumbnail(self, file_path: Path, target_size: int) -> Optional[bytes]:
        try:
            with Image.open(file_path) as img:
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=self.quality, optimize=True)
                return buffer.getvalue()
        except Exception as e:
            print(f"Error generating image thumbnail: {e}")
            return None

    async def _generate_gif_thumbnail(self, file_path: Path, target_size: int) -> Optional[bytes]:
        try:
            with Image.open(file_path) as img:
                img.seek(0)
                frame = img.convert('RGB')
                frame.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                frame.save(buffer, format='JPEG', quality=self.quality, optimize=True)
                return buffer.getvalue()
        except Exception as e:
            print(f"Error generating GIF thumbnail: {e}")
            return None

    async def _generate_video_thumbnail(self, file_path: Path, target_size: int) -> Optional[bytes]:
        try:
            result = subprocess.run(
                [
                    'ffmpeg', '-i', str(file_path), '-ss', '00:00:01', '-vframes', '1',
                    '-vf', f'scale={target_size}:{target_size}:force_original_aspect_ratio=decrease',
                    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '5', '-'
                ],
                capture_output=True,
                timeout=30,
            )
            if result.returncode == 0 and result.stdout:
                return result.stdout
            return None
        except subprocess.TimeoutExpired:
            return None
        except FileNotFoundError:
            return None
        except Exception as e:
            print(f"Error generating video thumbnail: {e}")
            return None

    def clear_cache(self, file_path: Optional[Path] = None) -> int:
        count = 0
        if file_path:
            for size in self.sizes:
                cache_key = self._get_cache_key(file_path, size)
                cache_path = self._get_cache_path(cache_key)
                if cache_path.exists():
                    cache_path.unlink()
                    count += 1
        else:
            for cache_file in self.cache_dir.glob("*.jpg"):
                cache_file.unlink()
                count += 1
        return count
