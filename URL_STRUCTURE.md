# FilaMama URL Structure

FilaMama uses URL-based state management to make every view bookmarkable and shareable.

## URL Components

### Base Structure

```
http://spark.local:8010/browse/path/to/folder?param1=value1&param2=value2
                        └─────┬─────┘└──┬──┘  └──────────┬─────────────┘
                          Route    Path      Query Parameters
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/browse` (home) |
| `/browse` | Home directory (root) |
| `/browse/home/user` | Specific folder path |
| `/browse/home/user/Documents` | Nested folder |

**Path Rules:**
- Paths are absolute from the backend root (`/home/flatstone`)
- Empty path → root directory (`/`)
- Path must be URL-encoded if it contains special characters

## Query Parameters

All view settings are stored in URL query parameters, making them bookmarkable and shareable.

### View Settings

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `view` | `grid`, `list` | `grid` | Display mode for files |
| `size` | `80-200` | `120` | Thumbnail size in grid view (pixels) |

**Examples:**
```
/browse?view=list                    # List view
/browse?view=grid&size=150           # Grid view with larger thumbnails
/browse/Documents?view=list          # Documents in list view
```

**Behavior:**
- Default values are omitted from URL (cleaner URLs)
- `view=grid` is omitted (default)
- `size=120` is omitted (default)
- Settings persist when navigating to other folders

### Search and Filters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `search` | any string | none | Search query (filters files by name) |
| `filter` | `photos`, `videos`, `gifs`, `pdfs`, `audio` | none | Content type filter |

**Examples:**
```
/browse?search=report                # Search for "report"
/browse/Pictures?filter=photos       # Show only photos
/browse?search=vacation&filter=photos # Search photos containing "vacation"
```

**Behavior:**
- Search is case-insensitive
- Filter shows only files of that type (hides folders)
- Both are cleared when navigating to a different folder
- Can be used together

### File Preview

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `file` | filename | none | File to preview in modal |

**Examples:**
```
/browse/Documents?file=report.pdf       # Preview report.pdf
/browse/Pictures?file=vacation.jpg      # Preview vacation.jpg
/browse/Videos?file=movie.mp4          # Preview movie.mp4
```

**Behavior:**
- Opens preview modal automatically
- Must be a file in the current directory
- If file doesn't exist, parameter is ignored
- Cleared when navigating to a different folder
- Use URL-encoded filename for special characters

## Complete Examples

### Simple Navigation
```
/browse                              # Home directory, grid view
/browse/Documents                    # Documents folder, grid view
/browse/Pictures                     # Pictures folder, grid view
```

### With View Settings
```
/browse?view=list                    # Home in list view
/browse/Documents?view=list&size=150 # Documents in list view, larger icons
```

### With Search
```
/browse/Documents?search=2024        # Search documents for "2024"
/browse/Pictures?search=vacation     # Search pictures for "vacation"
```

### With Filter
```
/browse/Pictures?filter=photos       # Show only image files
/browse/Documents?filter=pdfs        # Show only PDF files
/browse?filter=videos                # Show only videos in home
```

### With File Preview
```
/browse/Documents?file=report.pdf                      # Preview PDF
/browse/Pictures?file=vacation.jpg&view=grid           # Preview image in grid view
/browse/Videos?file=movie.mp4&filter=videos            # Preview video with filter active
```

### Combined Parameters
```
/browse/Pictures?view=list&search=vacation&filter=photos
# List view, searching for "vacation", showing only photos

/browse/Documents?view=grid&size=150&file=report.pdf
# Grid view, large thumbnails, previewing report.pdf

/browse?view=list&search=project&filter=pdfs&file=spec.pdf
# List view, searching PDFs for "project", previewing spec.pdf
```

## URL State Behavior

### What Persists When Navigating?

| Setting | Persists? | Reason |
|---------|-----------|--------|
| View mode (`view`) | ✅ Yes | User preference should carry over |
| Grid size (`size`) | ✅ Yes | User preference should carry over |
| Search (`search`) | ❌ No | Search is folder-specific |
| Filter (`filter`) | ❌ No | Filter is folder-specific |
| Preview (`file`) | ❌ No | File only exists in one folder |

**Example:**
```
Current: /browse/Documents?view=list&size=150&search=report&file=doc.pdf
Click folder "2024"
Result: /browse/Documents/2024?view=list&size=150
```

### Browser Back/Forward

✅ **Fully supported** - All URL state is properly tracked in browser history.

**Example:**
1. Navigate to `/browse/Documents`
2. Change to list view → `/browse/Documents?view=list`
3. Search for "report" → `/browse/Documents?view=list&search=report`
4. Click browser back button → `/browse/Documents?view=list`
5. Click browser back button → `/browse/Documents`

### Bookmarking

✅ **Fully supported** - Bookmark any URL and return to the exact same view.

**What's preserved:**
- Current folder
- View mode (grid/list)
- Grid size
- Search query
- Active filter
- Preview file

**Example bookmarks:**
```
Bookmark: "Documents - List View"
URL: /browse/Documents?view=list

Bookmark: "Pictures - Large Grid"
URL: /browse/Pictures?size=180

Bookmark: "Project PDFs"
URL: /browse/Work/Projects?filter=pdfs
```

### Sharing

✅ **Fully supported** - Share URLs with others to show exact view.

**Use cases:**
- Share a specific file preview
- Share a search result
- Share a filtered view
- Share with preferred view mode

**Example:**
```
Email to colleague:
"Here's the Q4 report: http://spark.local:8010/browse/Reports/2024?file=Q4-Report.pdf"

When they click, they see:
- Reports/2024 folder
- Q4-Report.pdf automatically previewed
```

## URL Encoding

### Special Characters

URLs must be properly encoded. FilaMama handles this automatically, but if constructing URLs manually:

| Character | Encoded | Example |
|-----------|---------|---------|
| Space | `%20` | `My File.pdf` → `My%20File.pdf` |
| `#` | `%23` | `File#1.pdf` → `File%2F1.pdf` |
| `?` | `%3F` | `What?.pdf` → `What%3F.pdf` |
| `&` | `%26` | `A&B.pdf` → `A%26B.pdf` |

**JavaScript encoding:**
```javascript
const filename = "My Report #1.pdf"
const url = `/browse/Documents?file=${encodeURIComponent(filename)}`
// Result: /browse/Documents?file=My%20Report%20%231.pdf
```

## Query Parameter Priority

When multiple parameters affect the same view:

1. **Path** (folder) - determines which files to show
2. **Filter** - reduces files by type
3. **Search** - further reduces by name match
4. **View** - determines how to display results
5. **Size** - affects display size (grid only)
6. **File** - opens preview modal

## Default Values

To keep URLs clean, default values are omitted:

| Parameter | Default | Omitted |
|-----------|---------|---------|
| `view` | `grid` | ✅ |
| `size` | `120` | ✅ |
| `search` | none | ✅ |
| `filter` | none | ✅ |
| `file` | none | ✅ |

**Example:**
```
Clean: /browse/Documents
Full:  /browse/Documents?view=grid&size=120
Both represent the same state!
```

## Implementation Details

### React Router

FilaMama uses React Router v6 with the `useSearchParams` hook:

```typescript
const [searchParams, setSearchParams] = useSearchParams()

// Read
const viewMode = searchParams.get('view') || 'grid'

// Write
setSearchParams(prev => {
  const newParams = new URLSearchParams(prev)
  newParams.set('view', 'list')
  return newParams
}, { replace: true })
```

### Replace vs Push

FilaMama uses `replace: true` for most URL updates:

- ✅ **Replace**: View settings, search, filter changes
- ❌ **Push**: Folder navigation (for back button)

**Reason:** You don't want every keystroke in search to create a history entry.

### State Synchronization

URL is the single source of truth:
1. Component reads state from URL
2. User action updates URL
3. React Router triggers re-render
4. Component reads new state from URL

No separate state variables needed!

## Testing URLs

### Manual Testing

Test these URLs directly in your browser:

```bash
# Basic navigation
http://spark.local:8010/browse
http://spark.local:8010/browse/Documents
http://spark.local:8010/browse/Pictures

# View modes
http://spark.local:8010/browse?view=list
http://spark.local:8010/browse/Documents?view=list&size=150

# Search and filter
http://spark.local:8010/browse?search=test
http://spark.local:8010/browse/Pictures?filter=photos
http://spark.local:8010/browse?search=report&filter=pdfs

# File preview (replace with actual filename)
http://spark.local:8010/browse/Documents?file=example.pdf
```

### Automated Testing

Test checklist:
- [ ] Bookmark a URL, close browser, reopen → same view
- [ ] Share URL with colleague → they see same view
- [ ] Browser back button works correctly
- [ ] Browser forward button works correctly
- [ ] Refresh page → view persists
- [ ] Navigate to folder → view settings persist
- [ ] Navigate to folder → search/filter/preview clear
- [ ] Change view → URL updates
- [ ] Change grid size → URL updates
- [ ] Type in search → URL updates (debounced)
- [ ] Click filter → URL updates
- [ ] Click file → URL updates
- [ ] Close preview → URL updates
- [ ] Default values omitted from URL

## Troubleshooting

### URL doesn't update
- Check browser console for errors
- Verify React Router is working
- Check `useSearchParams` hook is imported

### URL updates but view doesn't change
- Verify component is reading from URL
- Check for stale state variables
- Ensure no `useState` is overriding URL

### Browser back doesn't work
- Check that navigation uses `navigate()` not `setSearchParams()`
- Verify folder navigation doesn't use `replace: true`

### Shared URL doesn't work for others
- Verify backend is accessible to them
- Check file exists in the folder
- Ensure special characters are URL-encoded

## Future Enhancements

Potential additions:
- `sort=name|size|date` - Sort order
- `order=asc|desc` - Sort direction
- `select=file1,file2` - Pre-selected files
- `zoom=fit|actual` - Image preview zoom
- `page=3` - PDF page number
- `play=true` - Auto-play video

These can be added incrementally without breaking existing URLs.
