"""Audio metadata extraction service using mutagen."""

from pathlib import Path
from typing import Optional, Dict, Any
import io

try:
    from mutagen import File as MutagenFile
    from mutagen.id3 import ID3
    from mutagen.mp3 import MP3
    from mutagen.flac import FLAC
    from mutagen.mp4 import MP4
    from mutagen.oggvorbis import OggVorbis
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False


class AudioMetadataService:
    """Service for extracting metadata from audio files."""

    SUPPORTED_EXTENSIONS = {'.mp3', '.flac', '.ogg', '.m4a', '.mp4', '.wav', '.wma', '.aac', '.opus'}

    def __init__(self, root_path: Path):
        self.root_path = root_path

    def get_absolute_path(self, relative_path: str) -> Path:
        """Convert relative path to absolute path."""
        if relative_path.startswith('/'):
            relative_path = relative_path[1:]
        return self.root_path / relative_path

    def is_supported(self, file_path: Path) -> bool:
        """Check if file type is supported for metadata extraction."""
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS

    def get_metadata(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Extract metadata from an audio file."""
        if not HAS_MUTAGEN:
            return None

        if not file_path.exists() or not self.is_supported(file_path):
            return None

        try:
            audio = MutagenFile(file_path)
            if audio is None:
                return None

            metadata = {
                'title': None,
                'artist': None,
                'album': None,
                'album_artist': None,
                'track_number': None,
                'year': None,
                'genre': None,
                'duration': None,
                'bitrate': None,
                'sample_rate': None,
                'channels': None,
                'has_cover': False,
            }

            # Get audio info
            if audio.info:
                metadata['duration'] = audio.info.length
                if hasattr(audio.info, 'bitrate'):
                    metadata['bitrate'] = audio.info.bitrate
                if hasattr(audio.info, 'sample_rate'):
                    metadata['sample_rate'] = audio.info.sample_rate
                if hasattr(audio.info, 'channels'):
                    metadata['channels'] = audio.info.channels

            # Extract tags based on file type
            if isinstance(audio, MP3) or hasattr(audio, 'ID3'):
                metadata = self._extract_id3_tags(audio, metadata)
            elif isinstance(audio, FLAC):
                metadata = self._extract_flac_tags(audio, metadata)
            elif isinstance(audio, MP4):
                metadata = self._extract_mp4_tags(audio, metadata)
            elif isinstance(audio, OggVorbis):
                metadata = self._extract_vorbis_tags(audio, metadata)
            elif hasattr(audio, 'tags') and audio.tags:
                # Generic tag extraction
                metadata = self._extract_generic_tags(audio, metadata)

            return metadata

        except Exception as e:
            print(f"Error extracting audio metadata: {e}")
            return None

    def _extract_id3_tags(self, audio, metadata: Dict) -> Dict:
        """Extract ID3 tags (MP3)."""
        tags = audio.tags
        if not tags:
            return metadata

        # Standard ID3 frames
        tag_mapping = {
            'TIT2': 'title',
            'TPE1': 'artist',
            'TALB': 'album',
            'TPE2': 'album_artist',
            'TRCK': 'track_number',
            'TYER': 'year',
            'TDRC': 'year',
            'TCON': 'genre',
        }

        for frame_id, field in tag_mapping.items():
            if frame_id in tags:
                value = tags[frame_id]
                if hasattr(value, 'text'):
                    metadata[field] = str(value.text[0]) if value.text else None
                else:
                    metadata[field] = str(value)

        # Check for cover art (APIC frames)
        for key in tags.keys():
            if key.startswith('APIC'):
                metadata['has_cover'] = True
                break

        return metadata

    def _extract_flac_tags(self, audio, metadata: Dict) -> Dict:
        """Extract FLAC tags."""
        if not audio.tags:
            return metadata

        tag_mapping = {
            'title': 'title',
            'artist': 'artist',
            'album': 'album',
            'albumartist': 'album_artist',
            'tracknumber': 'track_number',
            'date': 'year',
            'genre': 'genre',
        }

        for tag, field in tag_mapping.items():
            if tag in audio.tags:
                metadata[field] = audio.tags[tag][0]

        # Check for cover art
        if audio.pictures:
            metadata['has_cover'] = True

        return metadata

    def _extract_mp4_tags(self, audio, metadata: Dict) -> Dict:
        """Extract MP4/M4A tags."""
        tags = audio.tags
        if not tags:
            return metadata

        tag_mapping = {
            '\xa9nam': 'title',
            '\xa9ART': 'artist',
            '\xa9alb': 'album',
            'aART': 'album_artist',
            'trkn': 'track_number',
            '\xa9day': 'year',
            '\xa9gen': 'genre',
        }

        for tag, field in tag_mapping.items():
            if tag in tags:
                value = tags[tag]
                if isinstance(value, list) and value:
                    if field == 'track_number' and isinstance(value[0], tuple):
                        metadata[field] = str(value[0][0])
                    else:
                        metadata[field] = str(value[0])

        # Check for cover art
        if 'covr' in tags:
            metadata['has_cover'] = True

        return metadata

    def _extract_vorbis_tags(self, audio, metadata: Dict) -> Dict:
        """Extract Vorbis comments (OGG)."""
        if not audio.tags:
            return metadata

        tag_mapping = {
            'title': 'title',
            'artist': 'artist',
            'album': 'album',
            'albumartist': 'album_artist',
            'tracknumber': 'track_number',
            'date': 'year',
            'genre': 'genre',
        }

        for tag, field in tag_mapping.items():
            if tag in audio.tags:
                metadata[field] = audio.tags[tag][0]

        # Check for cover art in metadata_block_picture
        if 'metadata_block_picture' in audio.tags:
            metadata['has_cover'] = True

        return metadata

    def _extract_generic_tags(self, audio, metadata: Dict) -> Dict:
        """Generic tag extraction for other formats."""
        tags = audio.tags
        if not tags:
            return metadata

        # Try common tag names
        for tag in ['title', 'TITLE']:
            if tag in tags:
                metadata['title'] = str(tags[tag][0]) if isinstance(tags[tag], list) else str(tags[tag])
                break

        for tag in ['artist', 'ARTIST']:
            if tag in tags:
                metadata['artist'] = str(tags[tag][0]) if isinstance(tags[tag], list) else str(tags[tag])
                break

        for tag in ['album', 'ALBUM']:
            if tag in tags:
                metadata['album'] = str(tags[tag][0]) if isinstance(tags[tag], list) else str(tags[tag])
                break

        return metadata

    def get_cover_art(self, file_path: Path) -> Optional[tuple[bytes, str]]:
        """
        Extract cover art from an audio file.
        Returns tuple of (image_bytes, mime_type) or None if no cover art.
        """
        if not HAS_MUTAGEN:
            return None

        if not file_path.exists() or not self.is_supported(file_path):
            return None

        try:
            audio = MutagenFile(file_path)
            if audio is None:
                return None

            # MP3 with ID3 tags
            if isinstance(audio, MP3) or hasattr(audio, 'ID3'):
                tags = audio.tags
                if tags:
                    for key in tags.keys():
                        if key.startswith('APIC'):
                            apic = tags[key]
                            return (apic.data, apic.mime)

            # FLAC
            elif isinstance(audio, FLAC):
                if audio.pictures:
                    pic = audio.pictures[0]
                    return (pic.data, pic.mime)

            # MP4/M4A
            elif isinstance(audio, MP4):
                tags = audio.tags
                if tags and 'covr' in tags:
                    cover = tags['covr'][0]
                    # MP4 cover format
                    if hasattr(cover, 'imageformat'):
                        mime = 'image/jpeg' if cover.imageformat == 13 else 'image/png'
                    else:
                        mime = 'image/jpeg'
                    return (bytes(cover), mime)

            # OGG Vorbis
            elif isinstance(audio, OggVorbis):
                if 'metadata_block_picture' in audio.tags:
                    import base64
                    from mutagen.flac import Picture
                    data = base64.b64decode(audio.tags['metadata_block_picture'][0])
                    pic = Picture(data)
                    return (pic.data, pic.mime)

            return None

        except Exception as e:
            print(f"Error extracting cover art: {e}")
            return None
