# FilaMama User Guide

A comprehensive guide to using FilaMama's features.

## Table of Contents

1. [Navigation](#navigation)
2. [File Selection](#file-selection)
3. [File Operations](#file-operations)
4. [Drag and Drop](#drag-and-drop)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [File Preview](#file-preview)
7. [Search and Filters](#search-and-filters)
8. [URL Structure and Bookmarking](#url-structure-and-bookmarking)

---

## Navigation

### Breadcrumb Navigation
- Click any folder name in the breadcrumb trail at the top to jump directly to that folder
- The breadcrumb shows your current location in the file system

### Sidebar Navigation
The sidebar provides quick access to common locations:

**Favorites**
- Custom bookmarks to frequently accessed folders
- *Coming soon: Add/remove favorites via context menu*

**Main Folders**
- Home: Your home directory
- Documents, Downloads, Pictures, Videos, Music: Standard system folders

**Content Type Filters**
- Photos: Filter to show only image files
- Videos: Filter to show only video files
- GIFs: Filter to show only animated GIFs
- PDFs: Filter to show only PDF documents
- Audio: Filter to show only audio files

### Single-Click Navigation
- Click once on a folder to open it
- Click once on a file to preview it

---

## File Selection

### Single Selection
- Click on a file or folder to select it
- The selected item will be highlighted

### Multi-Selection

**Using Checkboxes:**
- Hover over any file/folder to reveal a checkbox in the top-left corner
- Click the checkbox to toggle selection
- Works in both grid and list views

**Using Keyboard:**
- Hold `Ctrl` (Windows/Linux) or `Cmd` (Mac) and click files to add/remove from selection
- Press `Ctrl/Cmd + A` to select all files in the current view
- Press `Escape` to clear selection

**Visual Feedback:**
- Selected files have a highlighted background and blue ring
- Checkboxes remain visible on selected items

---

## File Operations

### Creating Folders
1. Click the "New Folder" button in the toolbar (top-right)
2. Enter a folder name in the dialog
3. Click "Create" or press Enter

### Renaming Files

**Using Context Menu:**
1. Right-click on a file or folder
2. Select "Rename" from the menu
3. Enter the new name
4. Click "Rename" or press Enter

**Using Keyboard:**
1. Select a file or folder
2. Press `F2`
3. Enter the new name
4. Click "Rename" or press Enter

### Copying Files

**Using Context Menu:**
1. Select one or more files/folders
2. Right-click on any selected item
3. Select "Copy" from the menu
4. Navigate to the destination folder
5. Right-click and select "Paste" (or use Ctrl/Cmd + V)

**Using Keyboard:**
1. Select one or more files/folders
2. Press `Ctrl/Cmd + C` to copy
3. Navigate to the destination folder
4. Press `Ctrl/Cmd + V` to paste

### Cutting/Moving Files

**Using Context Menu:**
1. Select one or more files/folders
2. Right-click on any selected item
3. Select "Cut" from the menu
4. Navigate to the destination folder
5. Right-click and select "Paste" (or use Ctrl/Cmd + V)

**Using Keyboard:**
1. Select one or more files/folders
2. Press `Ctrl/Cmd + X` to cut
3. Navigate to the destination folder
4. Press `Ctrl/Cmd + V` to paste (items will be moved)

**Using Drag and Drop:**
- See [Drag and Drop](#drag-and-drop) section below

### Deleting Files

**Using Context Menu:**
1. Select one or more files/folders
2. Right-click on any selected item
3. Select "Delete" from the menu
4. Confirm deletion in the dialog

**Using Keyboard:**
1. Select one or more files/folders
2. Press `Delete`
3. Confirm deletion in the dialog

**Using Toolbar:**
1. Select one or more files/folders
2. Click the trash icon in the toolbar
3. Confirm deletion in the dialog

### Downloading Files

**Single File:**
1. Right-click on a file
2. Select "Download" from the menu
3. The file will download to your browser's download folder

**Multiple Files:**
1. Select multiple files/folders
2. Click the download button in the toolbar
3. A ZIP archive will be created and downloaded

---

## Drag and Drop

### Uploading Files

**Drag Files onto the Window:**
1. Select files from your file manager
2. Drag them onto the FilaMama window
3. Drop them anywhere in the file list area
4. Upload progress will be shown at the bottom

**Drag Folders:**
- You can drag entire folders to upload all contents recursively
- Folder structure will be preserved

**Upload Progress:**
- A progress panel appears at the bottom showing all active uploads
- Each file shows its upload progress percentage
- Completed uploads show a checkmark
- Failed uploads show an error message
- Click "Clear All" to dismiss all completed uploads

### Moving Files (Drag and Drop)

**Basic Moving:**
1. Click and drag any file or folder
2. Hover over a destination folder
3. The destination folder will highlight with a blue ring
4. Release the mouse button to drop and move the file

**Moving Multiple Files:**
1. Select multiple files/folders (using checkboxes or Ctrl/Cmd+Click)
2. Drag any of the selected items
3. All selected items will be moved together
4. Dragged items appear semi-transparent during the drag

**Visual Feedback:**
- **Dragging:** Selected items become semi-transparent (50% opacity)
- **Valid Drop Target:** Folders show a blue ring when you hover over them
- **Invalid Drop Target:** Regular files don't highlight (can't drop into them)

**Works In:**
- Grid view
- List view
- With single files
- With multiple selected files

**Limitations:**
- You can only drop files onto folders (not onto regular files)
- You cannot drop a folder onto itself
- Drag and drop moves files within the current directory only

---

## Keyboard Shortcuts

### Selection
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + A` | Select all files in current view |
| `Escape` | Clear selection |
| `Ctrl/Cmd + Click` | Toggle individual file selection |

### File Operations
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + C` | Copy selected files |
| `Ctrl/Cmd + X` | Cut selected files |
| `Ctrl/Cmd + V` | Paste files |
| `Delete` | Delete selected files |
| `F2` | Rename selected file (single selection only) |

### Navigation
| Shortcut | Action |
|----------|--------|
| `Enter` | Open selected file/folder (single selection only) |
| `Backspace` | Navigate to parent directory |
| `Escape` | Clear search query |

### Preview Modal
| Shortcut | Action |
|----------|--------|
| `Left Arrow` | Previous file |
| `Right Arrow` | Next file |
| `Escape` | Close preview |

### Notes
- Shortcuts are disabled when typing in input fields (search, rename dialogs, etc.)
- On macOS, use `Cmd` instead of `Ctrl`
- On Windows/Linux, use `Ctrl`

---

## File Preview

### Supported File Types
- **Images:** JPG, PNG, GIF, WebP, SVG, BMP, ICO, TIFF
- **Videos:** MP4, MKV, AVI, MOV, WebM, FLV, WMV, M4V
- **Audio:** MP3, WAV, FLAC, AAC, OGG, M4A, WMA, Opus
- **PDF:** All PDF documents
- **Text:** TXT, LOG, CSV, and code files (JS, TS, Python, etc.)

### Opening Preview

**Using Single Click:**
- Click on any file to open preview modal

**Using Context Menu:**
1. Right-click on a file
2. Select "Preview" from the menu

**Using Keyboard:**
1. Select a file
2. Press `Enter`

### Preview Navigation
- Use arrow keys (← →) or click the arrow buttons to navigate between files
- Close preview with `Escape` or click the X button
- Preview shows filename and file size

### Preview Features

**Images:**
- Full-size display with zoom fit
- Navigate between images in the same folder

**Videos:**
- HTML5 video player with controls
- Play, pause, seek, volume control
- Fullscreen support

**Audio:**
- HTML5 audio player with controls
- Play, pause, seek, volume control

**PDFs:**
- Custom PDF viewer with consistent experience
- Page navigation with prev/next buttons
- Zoom controls (50% to 300%)
- Page counter showing current page and total pages
- Text selection and copy support
- Works identically on all browsers and mobile devices

**Text Files:**
- Syntax highlighting for code files
- Read-only view
- *Coming soon: Edit and save text files*

---

## Search and Filters

### Search Bar
Located in the top-right corner:
1. Click the search bar or press `Ctrl/Cmd + F`
2. Type your search query
3. Files are filtered in real-time as you type
4. Press `Escape` to clear search

**Search Features:**
- Case-insensitive search
- Searches in current folder only
- Matches filename substrings
- Works with all file types

### Content Type Filters
Located in the sidebar:
- Click any content type (Photos, Videos, GIFs, PDFs, Audio)
- View switches to show only files of that type in current folder
- Click the same filter again to turn it off
- Only one filter can be active at a time

**Note:** Content type filters currently work within the current folder only. Recursive search across all folders is planned for a future release.

### View Options

**Grid vs List View:**
- Toggle between grid and list views using the button in the toolbar (top-right)
- Grid view: Shows large thumbnails in a responsive grid
- List view: Shows files in a table with name, size, and modified date

**Thumbnail Size Slider:**
- Available in grid view only
- Use the slider in the toolbar to adjust thumbnail size
- Range: 80px to 200px
- Changes take effect immediately

**Refresh:**
- Click the refresh button in the toolbar to reload the current folder
- Useful after external file system changes

---

## Tips and Tricks

### Efficiency Tips
1. **Use keyboard shortcuts** for quick operations (Ctrl+C, Ctrl+V, etc.)
2. **Use drag and drop** for fast file moving within folders
3. **Use checkboxes** for easy multi-selection without keyboard modifiers
4. **Use content type filters** to quickly find specific file types
5. **Use breadcrumbs** to jump quickly between parent folders

### Multi-Selection Workflow
1. Click checkboxes on files to select them
2. Right-click any selected file for bulk operations
3. All selected files will be affected by the operation

### Upload Workflow
1. Drag files/folders from your desktop
2. Drop onto FilaMama window
3. Monitor progress at the bottom
4. Continue working while uploads complete

### Best Practices
- Use the search bar to find files quickly in large folders
- Enable content type filters when looking for specific file types
- Use grid view for visual browsing (images, videos)
- Use list view for text-heavy files (documents, code)
- Preview files before downloading to verify content

---

## Troubleshooting

### Files not showing up
- Click the refresh button in the toolbar
- Check if a content type filter is active (clear it)
- Check if search bar has text (clear it with Escape)

### Upload not working
- Check that the backend server is running
- Verify file size is under the upload limit
- Check browser console for errors

### Drag and drop not working
- Ensure you're dropping onto a folder (not a file)
- Try using cut/paste instead (Ctrl+X, Ctrl+V)
- Verify the destination folder has write permissions

### Keyboard shortcuts not working
- Check that focus is not in an input field
- Try clicking on the file list area first
- Verify no modal dialogs are open

---

---

## URL Structure and Bookmarking

### Every View is Bookmarkable

FilaMama stores all view settings in the URL, making every view bookmarkable and shareable.

### URL Parameters

**View Settings:**
- `view=list` - List view mode (default: grid)
- `size=150` - Grid thumbnail size in pixels (default: 120)

**Filters and Search:**
- `search=vacation` - Search query
- `filter=photos` - Content type filter (photos, videos, gifs, pdfs, audio)

**File Preview:**
- `file=report.pdf` - File to preview

### Examples

**Simple Navigation:**
```
/browse                    # Home directory
/browse/Documents          # Documents folder
/browse/Pictures           # Pictures folder
```

**With View Settings:**
```
/browse?view=list                    # List view
/browse/Documents?view=list&size=150 # List view with larger thumbnails
```

**With Search and Filters:**
```
/browse/Pictures?filter=photos       # Show only photos
/browse?search=report&filter=pdfs    # Search PDFs for "report"
```

**With File Preview:**
```
/browse/Documents?file=report.pdf              # Preview a specific PDF
/browse/Pictures?file=vacation.jpg&view=grid   # Preview image in grid view
```

### Bookmarking

1. Navigate to the view you want
2. The URL automatically updates
3. Bookmark the URL (Ctrl/Cmd + D)
4. Return anytime to the exact same view

**Useful Bookmarks:**
- Documents in list view
- Pictures with photo filter
- Videos folder in grid view with large thumbnails
- Specific project folder with search

### Sharing Links

Copy the URL and share it with others:
- They'll see the same folder
- Same view mode and settings
- Same search/filter applied
- Same file preview open

**Example:**
```
Share: http://spark.local:8010/browse/Reports/2024?file=Q4-Report.pdf
Result: Opens Reports/2024 folder with Q4-Report.pdf previewed
```

### Browser Navigation

**Back/Forward Buttons:**
- ✅ Fully supported
- Navigate through your history
- All view settings preserved

**Refresh:**
- ✅ Reloads with same view
- Search and filters persist
- Preview stays open

### What Persists?

**When navigating to a different folder:**

Kept:
- ✅ View mode (grid/list)
- ✅ Grid size

Cleared:
- ❌ Search query (folder-specific)
- ❌ Content filter (folder-specific)
- ❌ File preview (file-specific)

**Reason:** View preferences should carry over, but search and filters are specific to each folder.

### Clean URLs

Default values are omitted to keep URLs clean:
- `view=grid` (default) → omitted
- `size=120` (default) → omitted

So `/browse` and `/browse?view=grid&size=120` are equivalent.

### For More Details

See **[URL_STRUCTURE.md](URL_STRUCTURE.md)** for complete technical documentation, including:
- All parameters and values
- URL encoding rules
- Implementation details
- Testing checklist

---

## What's Next?

Planned features:
- Recursive content type search across entire filesystem
- Add/remove favorites from context menu
- Dark/light theme toggle
- Arrow key navigation in file grid/list
- Drag and drop to sidebar folders
- Text file editing
- Bulk rename operations
- Advanced search filters
- Sort order in URL (sort=name&order=asc)
