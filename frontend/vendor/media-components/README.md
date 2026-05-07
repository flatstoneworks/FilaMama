# @flatstoneworks/media-components

Shared media components for FLATSTONE projects — video player, preview thumbnails, and media utilities.

## Install

```bash
npm install @flatstoneworks/media-components
```

Peer dependencies for **browser components**:

```bash
npm install react react-dom @radix-ui/react-slider lucide-react
```

Peer dependencies for **server-side thumbnails** (optional):

```bash
npm install sharp jszip
```

## Components

### VideoPlayer

Full-featured video player with controls, keyboard shortcuts, and fullscreen support.

```tsx
import { VideoPlayer } from '@flatstoneworks/media-components'

<VideoPlayer
  src="/videos/demo.mp4"
  title="Demo Video"
  videoWidth={1920}
  videoHeight={1080}
  onLoad={() => console.log('ready')}
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Video source URL (required) |
| `title` | `string` | Title displayed in the header overlay |
| `className` | `string` | Custom CSS class for the container |
| `autoPlay` | `boolean` | Auto-play on mount |
| `videoWidth` | `number` | Intrinsic width for aspect-ratio sizing |
| `videoHeight` | `number` | Intrinsic height for aspect-ratio sizing |
| `onLoad` | `() => void` | Called when video metadata loads |

**Keyboard shortcuts** (when player is focused):

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `J` / `ArrowLeft` | Skip back 10s |
| `L` / `ArrowRight` | Skip forward 10s |
| `ArrowUp` / `ArrowDown` | Volume up / down |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `0-9` | Jump to 0%-90% |
| `Escape` | Close speed menu |

### VideoPreview

Interactive video thumbnail with hover-based frame scrubbing. Uses a single `<video>` element that the browser seeks in place — no canvas, no `toDataURL`, no CORS requirements.

```tsx
import { VideoPreview } from '@flatstoneworks/media-components'

<VideoPreview
  src="/videos/demo.mp4"
  posterUrl="/thumbs/demo.jpg"
  videoWidth={1920}
  videoHeight={1080}
  objectFit="cover"
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | | Video source URL (required) |
| `posterUrl` | `string` | | Static poster image URL |
| `className` | `string` | | Custom CSS class |
| `width` | `number` | | Fixed width in pixels |
| `height` | `number` | | Fixed height in pixels |
| `aspectRatio` | `'video' \| 'square' \| 'none'` | `'none'` | Aspect ratio constraint |
| `videoWidth` | `number` | | Intrinsic width for CSS aspect-ratio |
| `videoHeight` | `number` | | Intrinsic height for CSS aspect-ratio |
| `duration` | `number` | | Override video duration for seek |
| `objectFit` | `'cover' \| 'contain'` | `'cover'` | Object-fit mode |
| `onLoad` | `() => void` | | Called when metadata loads |

### MediaSlider

Styled slider built on Radix UI.

```tsx
import { MediaSlider } from '@flatstoneworks/media-components'

<MediaSlider value={[50]} min={0} max={100} step={1} onValueChange={console.log} />
```

## Utilities

```tsx
import {
  AUDIO_EXTENSIONS,
  MEDIA_IMPORT_ACCEPT,
  isVideoFile,
  isImageFile,
  isAudioFile,
  isMediaFile,
  isSupportedMimeType,
  isSupportedExtension,
  getMediaKind,
  getMimeTypeForExtension,
  getPreferredExtensionForMime,
  buildAcceptString,
  videoNeedsTranscoding,
  formatVideoTime,
  cn,
  VIDEO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  BROWSER_NATIVE_VIDEO,
} from '@flatstoneworks/media-components'

isVideoFile('clip.mp4')           // true
isImageFile('photo.jpg')          // true
isImageFile('design.pxd')         // true
isAudioFile('track.flac')         // true
isMediaFile('recording.webm')     // true
getMediaKind('audio/webm')        // 'audio'
getMediaKind('clip.webm')         // 'video' (extension-only default)
getMimeTypeForExtension('m4a')    // 'audio/mp4'
getPreferredExtensionForMime('audio/x-wav') // 'wav'
videoNeedsTranscoding('clip.avi') // true (not browser-native)
formatVideoTime(3661)             // '1:01:01'
cn('px-2', condition && 'px-4')   // Tailwind-aware class merge

const accept = buildAcceptString({ kinds: ['image', 'video', 'audio'] })
accept === MEDIA_IMPORT_ACCEPT // true
```

### Import validation

Use the registry for both browser dropzones and server-side multipart validation. MIME metadata is more precise for ambiguous containers such as WebM and Ogg; use the filename extension as a fallback when the browser omits `File.type`.

```tsx
import {
  buildAcceptString,
  isSupportedExtension,
  isSupportedMimeType,
} from '@flatstoneworks/media-components'

const IMPORT_KINDS = ['image', 'video', 'audio'] as const
const ACCEPT_STRING = buildAcceptString({ kinds: IMPORT_KINDS })

function isAcceptedImport(file: File): boolean {
  return (
    isSupportedMimeType(file.type, IMPORT_KINDS) ||
    isSupportedExtension(file.name, IMPORT_KINDS)
  )
}

<input type="file" multiple accept={ACCEPT_STRING} />
```

## Supported Formats

| Kind | Extensions | MIME examples | Import | Browser preview | Server thumbnail |
|------|------------|---------------|--------|-----------------|------------------|
| Image | `jpg`, `jpeg`, `jfif`, `png`, `webp`, `gif`, `bmp`, `tiff`, `tif`, `avif`, `heic`, `heif`, `svg`, `pxd` | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/tiff`, `image/avif`, `image/heic`, `image/svg+xml`, `application/x-pixelmator-pxd` | Yes | Common browser formats only; TIFF/HEIC/HEIF/PXD are not browser-native | Yes via `sharp`; GIF uses first frame; SVG is rasterized; PXD uses embedded Quick Look preview |
| Video | `mp4`, `webm`, `mov`, `avi`, `mkv`, `m4v`, `ogg`, `ogv`, `flv`, `wmv`, `mpeg`, `mpg`, `3gp`, `3g2`, `ts`, `mts`, `m2ts` | `video/mp4`, `video/webm`, `video/quicktime`, `video/x-matroska` | Yes | `mp4`, `webm`, `m4v`, `ogg`, `ogv`; others usually need transcoding | Yes via `ffmpeg` |
| Audio | `mp3`, `wav`, `ogg`, `oga`, `flac`, `aac`, `m4a`, `webm`, `opus`, `aiff`, `aif` | `audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/ogg`, `audio/flac`, `audio/mp4`, `audio/webm` | Yes | Browser-dependent | No generated thumbnail |
| Ebook | `epub` | `application/epub+zip` | Yes | No | Yes, by extracting cover images |
| Document | `pdf` | `application/pdf` | No by default | Yes in browsers with PDF viewers | No |

### Pixelmator PXD

Pixelmator Pro documents (`.pxd`) preserve layers and nondestructive edits. This package does not decode Pixelmator layer data; server thumbnails and dimensions are generated from the embedded `QuickLook/Thumbnail.*` or `QuickLook/Preview.*` image when present. Both current zipped `.pxd` files and package-directory `.pxd` files are supported.

### Unsupported design formats

PSD is intentionally exposed as unsupported:

```ts
import {
  getUnsupportedFormatReason,
  isUnsupportedFormat,
} from '@flatstoneworks/media-components'

isUnsupportedFormat('design.psd') // true
isUnsupportedFormat('mockup.pxd') // false
```

Local feasibility check: this project currently uses Sharp `0.34.5` with libvips `8.17.3`; `sharp.format` exposes no PSD input loader. PSD support should not be claimed until there is a real decoder path and tests with representative files.

## Server: ThumbnailService

Server-side thumbnail generation and caching for images, videos, SVGs, GIFs, and EPUBs. Requires `sharp` and `jszip`.

```ts
import {
  THUMBNAIL_EXTENSIONS,
  ThumbnailService,
  isThumbnailableFile,
} from '@flatstoneworks/media-components/server'

const thumbs = new ThumbnailService({
  cacheDir: 'data/thumbnails',
  sizes: { thumb: 256, large: 1080 },
  quality: 85,
  maxCacheSizeMb: 500,
})

// Generate or retrieve a cached thumbnail (returns Buffer | null)
const jpegBytes = await thumbs.getThumbnail('/path/to/file.mp4', 'thumb')

// Guard work before calling into the service
if (isThumbnailableFile('/path/to/book.epub')) {
  await thumbs.getThumbnail('/path/to/book.epub', 'thumb')
}

console.log(THUMBNAIL_EXTENSIONS)

// Get image dimensions
const { width, height } = await thumbs.getImageDimensions('/path/to/image.png')

// Clear cache for a specific file, or all
await thumbs.clearCache('/path/to/file.mp4')
await thumbs.clearCache() // clear all

// Force an LRU eviction pass (normally runs lazily every 50 writes)
await thumbs.evict()
```

**Supported formats:**

| Format | How |
|--------|-----|
| JPEG, PNG, WebP, BMP, TIFF, AVIF | `sharp` resize + JPEG output |
| HEIC, HEIF | `sharp` when the installed libvips build can decode them |
| SVG | `sharp` with librsvg |
| GIF | `sharp` first-frame extraction |
| Pixelmator PXD | `jszip` or package-directory read of embedded Quick Look preview, then `sharp` resize |
| Video (mp4, mkv, avi, mov, etc.) | `ffmpeg` subprocess (must be on PATH) |
| EPUB | `jszip` cover extraction from OPF metadata + fallbacks |

`getThumbnail()` returns `null` for unsupported formats or when an optional decoder is unavailable. Pass a `logger` to see runtime failures such as a missing `ffmpeg` binary or an image format not supported by the installed Sharp/libvips build.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cacheDir` | `string` | | Directory for cached thumbnails (required, created lazily on first write) |
| `sizes` | `Record<string, number>` | | Named size presets in pixels (required) |
| `quality` | `number` | `85` | JPEG output quality (1-100) |
| `maxCacheSizeMb` | `number` | `0` | Max cache size; 0 = unlimited. Uses LRU eviction. |
| `logger` | `{ warn, info }` | no-op | Observe internal failures (missing files, ffmpeg errors, eviction scans) |
| `ffmpegPath` | `string` | `'ffmpeg'` | Override the ffmpeg binary path |

**Notes:**

- All I/O is non-blocking (`fs/promises`); safe to call from a request handler.
- There is **no file locking**. Two processes sharing the same `cacheDir` can write the same cache file concurrently without corruption (last writer wins, same bytes), but concurrent eviction may race — prefer a single writer process for strict cache-size enforcement.
- Eviction runs lazily every 50 writes when `maxCacheSizeMb > 0`. Call `await thumbs.evict()` explicitly for a strict upper bound.
- All generator methods return `null` on failure. Pass a `logger` to see what's going wrong.

## Development

```bash
npm install
npm run dev          # Watch mode
npm run lint         # Type check + ESLint
npm run format       # Prettier format
npm test             # Run tests
npm run build        # Build to dist/
```

## Requirements

- Node.js >= 18
- React >= 18
- Tailwind CSS (for styling classes)
