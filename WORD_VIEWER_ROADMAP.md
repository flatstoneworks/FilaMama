# Microsoft Word Viewer Roadmap

Status: planned feature. This document captures the implementation direction for adding Microsoft Word and related office document previews to FilaMama.

## Current State

FilaMama already has a dedicated PDF viewer in `frontend/src/components/PdfViewer.tsx`, wired through `frontend/src/pages/PreviewPage.tsx`.

Word files are recognized as documents by extension, but they are not currently previewable:

- `backend/config.yaml` includes `doc` and `docx` under the `document` file type group.
- `@flatstoneworks/ui` classifies `doc` and `docx` as `document`.
- The preview route only renders images, video, audio, PDFs, and text/code files.
- The shared `isPreviewable()` helper excludes Word documents.

Result: Word files are visible and downloadable, but there is no Word viewer.

## Recommendation

Implement Word viewing by converting office documents to PDF on the backend, then reuse the existing `PdfViewer`.

This is the strongest fit for FilaMama because:

- It preserves layout better than most browser-side DOCX-to-HTML libraries.
- It supports both modern `.docx` and legacy `.doc` when LibreOffice supports the input.
- It keeps the frontend simple.
- It reuses the existing PDF viewer controls, styling, and user flow.
- It works with FilaMama's single-process backend model, with LibreOffice as an optional system dependency.

The main tradeoff is that LibreOffice becomes a runtime dependency for this feature.

## Target Formats

Initial support:

- `.doc`
- `.docx`
- `.odt`
- `.rtf`

Possible later expansion:

- `.xls`, `.xlsx`, `.ods`
- `.ppt`, `.pptx`, `.odp`

Spreadsheets and presentations may need different viewer sizing and navigation expectations, so they should be treated as follow-up work rather than bundled into the first Word viewer milestone.

## Architecture

Use a backend conversion endpoint:

```text
GET /api/files/document-preview?path=/Documents/file.docx
```

Behavior:

1. Resolve and validate the requested path using the existing filesystem path security helpers.
2. Reject directories and unsupported extensions.
3. Build a cache key from path, file size, and modified timestamp.
4. If a cached PDF exists, return it.
5. Otherwise convert the document to PDF in a temporary working directory.
6. Store the converted PDF in a document preview cache directory.
7. Return the PDF with `application/pdf`.

Frontend behavior:

1. Add an `isOfficeDocument()` helper for Word-like extensions.
2. Treat supported office documents as previewable.
3. In `PreviewPage`, route office documents to `PdfViewer`.
4. Pass `api.getDocumentPreviewUrl(path, modified)` as the PDF URL.
5. Keep the existing download button pointing at the original file.

## Backend Design

Add a service similar in shape to thumbnail and transcoding services:

```text
backend/app/services/document_preview.py
```

Responsibilities:

- Check for a supported converter binary.
- Convert supported office documents to PDF.
- Manage cache paths.
- Enforce conversion timeout.
- Serialize duplicate conversions for the same source file.
- Clean up temporary input/output directories.

Recommended LibreOffice command pattern:

```bash
soffice \
  --headless \
  --nologo \
  --nofirststartwizard \
  --convert-to pdf \
  --outdir /tmp/filamama-doc-preview-out \
  /tmp/filamama-doc-preview-in/file.docx
```

Use a unique LibreOffice user profile per conversion or worker process:

```bash
-env:UserInstallation=file:///tmp/filamama-libreoffice-profile-<uuid>
```

This avoids profile lock conflicts when multiple conversions run at once.

## Caching

Add a dedicated cache directory:

```yaml
document_preview:
  enabled: true
  cache_dir: "data/document-previews"
  max_cache_size_mb: 1000
  timeout_seconds: 60
```

Cache key inputs:

- Resolved absolute path or stable relative path
- File size
- Modified timestamp
- Converter version, if practical

Generated files should not live next to user files. They should stay under FilaMama's data/cache directory.

## Dependency Handling

LibreOffice should be optional:

- If the binary is missing, the API should return a clear `503` or `501` style error.
- The frontend should show an inline message with a download action.
- Existing file browsing and download behavior must continue to work.

Install updates:

- Docker image: install LibreOffice packages in the runtime stage if the feature is enabled by default.
- Linux install script: add LibreOffice to package manager dependency lists.
- macOS install script: detect or install LibreOffice via Homebrew cask, or document manual installation.

Open question: decide whether LibreOffice is installed by default or remains opt-in to keep the base install lighter.

## Security Notes

Office document conversion is higher risk than static file serving because the converter parses complex untrusted files.

Required safeguards:

- Reuse existing path traversal protection.
- Run conversion in a temporary directory.
- Never overwrite user files.
- Set a strict timeout.
- Limit input file size for preview conversion.
- Limit conversion concurrency.
- Avoid network access from conversion where practical.
- Clean up temp directories after success and failure.
- Return conversion errors without exposing host paths.

For Docker, consider whether conversion should run in the same container or a separate sidecar if we later need stronger isolation.

## Frontend UX

The Word viewer should feel like a document preview, not an editor.

Expected behavior:

- Same black preview shell as PDF/image/video preview.
- File name in the preview header.
- Existing download button downloads the original `.doc` or `.docx`.
- `PdfViewer` toolbar handles page navigation and zoom.
- Conversion loading state uses the existing spinner style.
- Conversion failure explains that the document could not be previewed and offers download.

Avoid exposing LibreOffice implementation details in normal UI copy. The user only needs to know whether preview is available.

## Alternative Libraries

### docx-preview

Browser-side DOCX renderer that converts DOCX into HTML.

Pros:

- No backend conversion dependency.
- Simple frontend-only proof of concept.
- Good enough for some `.docx` documents.

Cons:

- `.docx` only, not legacy `.doc`.
- HTML rendering cannot fully match Word layout.
- Complex documents, pagination, fonts, headers, footers, and page breaks can differ.

Use this only if we want a lightweight DOCX-only preview with known fidelity limits.

### Mammoth.js

DOCX-to-clean-HTML converter.

Pros:

- Produces readable, semantic HTML.
- Good for text-heavy documents.
- Useful for extraction or content display.

Cons:

- Not a visual Word viewer.
- Intentionally ignores many layout details.
- Poor fit for preserving document appearance.

This is better for "read the text" than "preview the Word document."

### Pandoc

General document conversion tool.

Pros:

- Mature converter.
- Can read and write many document formats.
- Useful for content transformation workflows.

Cons:

- Not primarily a visual viewer.
- Layout fidelity is not the primary goal.
- PDF output often depends on additional PDF tooling.

This is not the recommended viewer path.

### ONLYOFFICE Docs or Collabora Online

Full browser-based office suites.

Pros:

- Highest feature ceiling.
- Real office document viewing and editing.
- Supports documents, spreadsheets, and presentations.

Cons:

- Requires a separate document server.
- More complex integration model.
- Adds operational burden.
- Pushes FilaMama away from a simple single-process deployment.

These are good options if FilaMama later wants full online office editing, but they are too heavy for a first read-only viewer.

## Implementation Milestones

### Milestone 1: Backend conversion proof

- Add `DocumentPreviewService`.
- Add `/api/files/document-preview`.
- Convert `.docx` to PDF through LibreOffice.
- Cache generated PDFs.
- Add backend tests for unsupported extension, missing file, path validation, and cache hit behavior.

### Milestone 2: Frontend integration

- Add API client URL helper.
- Add supported office document detection.
- Include supported office docs in preview navigation.
- Render converted PDFs through `PdfViewer`.
- Add failure state for conversion errors.

### Milestone 3: Packaging

- Add config defaults.
- Add Docker dependency.
- Update install script dependency handling.
- Document enabling/disabling the feature.

### Milestone 4: Validation

- Add fixture documents:
  - Simple `.docx`
  - Multi-page `.docx`
  - Document with images
  - Document with table
  - Legacy `.doc` if test tooling can provide one
- Add Playwright coverage for successful preview and failed conversion.
- Verify cache invalidates when source file changes.

## Acceptance Criteria

- Opening a supported Word document displays it in the preview page.
- Preview uses the existing PDF viewer controls.
- Download still returns the original Word file.
- Missing LibreOffice produces a clear, non-crashing fallback.
- Conversion does not block the event loop.
- Repeated previews use cache when the source file is unchanged.
- Cache invalidates after source file modification.
- Unsupported documents still download normally.

## Open Questions

- Should LibreOffice be installed by default in Docker and install scripts, or should document preview be opt-in?
- What maximum input size should be previewable?
- Should converted PDFs be included in a cache cleanup policy shared with thumbnails and transcoding?
- Do we want Word-only support first, or a broader office-preview feature from the start?
- Should preview generation be synchronous on first open or queued with polling for very large files?

