import hashlib
import subprocess
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
import io

try:
    import cairosvg
    HAS_CAIROSVG = True
except ImportError:
    HAS_CAIROSVG = False

# Register HEIC/HEIF/AVIF support if available
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HAS_HEIF = True
except ImportError:
    HAS_HEIF = False


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

        if suffix in ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.bmp', '.tiff', '.tif']:
            thumb_bytes = await self._generate_image_thumbnail(file_path, target_size)
        elif suffix in ['.heic', '.heif', '.avif'] and HAS_HEIF:
            thumb_bytes = await self._generate_image_thumbnail(file_path, target_size)
        elif suffix in ['.svg']:
            thumb_bytes = await self._generate_svg_thumbnail(file_path, target_size)
        elif suffix in ['.gif']:
            thumb_bytes = await self._generate_gif_thumbnail(file_path, target_size)
        elif suffix in ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v']:
            thumb_bytes = await self._generate_video_thumbnail(file_path, target_size)
        elif suffix in ['.epub']:
            thumb_bytes = await self._generate_epub_thumbnail(file_path, target_size)
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

    async def _generate_svg_thumbnail(self, file_path: Path, target_size: int) -> Optional[bytes]:
        """Generate thumbnail for SVG files using cairosvg."""
        if not HAS_CAIROSVG:
            return None
        try:
            # Convert SVG to PNG at target size
            png_data = cairosvg.svg2png(
                url=str(file_path),
                output_width=target_size,
                output_height=target_size,
            )
            # Convert PNG to JPEG for consistent caching
            with Image.open(io.BytesIO(png_data)) as img:
                # Handle transparency by compositing on white background
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=self.quality, optimize=True)
                return buffer.getvalue()
        except Exception as e:
            print(f"Error generating SVG thumbnail: {e}")
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

    async def _generate_epub_thumbnail(self, file_path: Path, target_size: int) -> Optional[bytes]:
        """Generate thumbnail for EPUB files by extracting the cover image."""
        try:
            with zipfile.ZipFile(file_path, 'r') as epub:
                # Try to find cover image in common locations
                cover_paths = []

                # Method 1: Look in META-INF/container.xml for the OPF file
                try:
                    container = epub.read('META-INF/container.xml')
                    root = ET.fromstring(container)
                    ns = {'cont': 'urn:oasis:names:tc:opendocument:xmlns:container'}
                    rootfile = root.find('.//cont:rootfile', ns)
                    if rootfile is not None:
                        opf_path = rootfile.get('full-path', '')
                        opf_dir = '/'.join(opf_path.split('/')[:-1])
                        opf_content = epub.read(opf_path)
                        opf_root = ET.fromstring(opf_content)

                        # Find cover in metadata
                        ns_opf = {'opf': 'http://www.idpf.org/2007/opf', 'dc': 'http://purl.org/dc/elements/1.1/'}
                        for meta in opf_root.findall('.//{http://www.idpf.org/2007/opf}meta'):
                            if meta.get('name') == 'cover':
                                cover_id = meta.get('content')
                                for item in opf_root.findall('.//{http://www.idpf.org/2007/opf}item'):
                                    if item.get('id') == cover_id:
                                        href = item.get('href', '')
                                        cover_paths.append(f"{opf_dir}/{href}" if opf_dir else href)

                        # Also look for items with cover in id/properties
                        for item in opf_root.findall('.//{http://www.idpf.org/2007/opf}item'):
                            item_id = item.get('id', '').lower()
                            props = item.get('properties', '').lower()
                            if 'cover' in item_id or 'cover' in props:
                                href = item.get('href', '')
                                cover_paths.append(f"{opf_dir}/{href}" if opf_dir else href)
                except Exception:
                    pass

                # Method 2: Common cover image paths
                common_covers = [
                    'cover.jpg', 'cover.jpeg', 'cover.png',
                    'OEBPS/cover.jpg', 'OEBPS/cover.jpeg', 'OEBPS/cover.png',
                    'OEBPS/images/cover.jpg', 'OEBPS/images/cover.jpeg', 'OEBPS/images/cover.png',
                    'images/cover.jpg', 'images/cover.jpeg', 'images/cover.png',
                    'OPS/cover.jpg', 'OPS/cover.jpeg', 'OPS/cover.png',
                ]
                cover_paths.extend(common_covers)

                # Method 3: Find any image with 'cover' in name
                for name in epub.namelist():
                    name_lower = name.lower()
                    if 'cover' in name_lower and any(name_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif']):
                        cover_paths.append(name)

                # Try to extract and process the first valid cover
                for cover_path in cover_paths:
                    # Normalize path
                    cover_path = cover_path.replace('//', '/').lstrip('/')
                    try:
                        cover_data = epub.read(cover_path)
                        with Image.open(io.BytesIO(cover_data)) as img:
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
                    except (KeyError, Exception):
                        continue

                return None
        except Exception as e:
            print(f"Error generating EPUB thumbnail: {e}")
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
