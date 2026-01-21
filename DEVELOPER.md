# FilaMama Developer Documentation

Technical documentation for developers working on FilaMama.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Drag and Drop Implementation](#drag-and-drop-implementation)
3. [Keyboard Shortcuts Implementation](#keyboard-shortcuts-implementation)
4. [State Management](#state-management)
5. [API Integration](#api-integration)
6. [Component Structure](#component-structure)
7. [Adding New Features](#adding-new-features)

---

## Architecture Overview

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **TanStack Query** (React Query) for server state management
- **Tailwind CSS + shadcn/ui** for consistent, accessible UI components
- **React Router** for URL-based navigation

### Backend Stack
- **FastAPI** for high-performance async API
- **Pydantic** for request/response validation
- **Pillow** for thumbnail generation
- **aiofiles** for async file I/O

### Key Design Patterns

**Single Source of Truth:**
- URL path (`/browse/path/to/folder`) drives the current directory
- React Router's `useLocation` hook derives `currentPath` from URL
- No separate state needed for current directory

**Optimistic Updates:**
- File operations immediately update local state
- TanStack Query automatically refetches on success
- Error handling reverts to previous state

**Compound Components:**
- FileGrid and FileList are separate components with identical props
- FilesPage manages state and passes handlers down
- Keeps components focused and testable

---

## Drag and Drop Implementation

### Overview
The drag and drop feature allows users to move files by dragging them onto folders. It's implemented using native HTML5 drag and drop APIs.

### Architecture

```
FilesPage (state management)
    ├── handleMove (API call)
    └── passes onMove to children
        ├── FileGrid (drag handlers)
        │   └── renders draggable file items
        └── FileList (drag handlers)
            └── renders draggable file items
```

### Implementation Details

#### 1. FileGrid.tsx / FileList.tsx

**State Management:**
```typescript
const [draggedFiles, setDraggedFiles] = useState<FileInfo[]>([])
const [dropTarget, setDropTarget] = useState<string | null>(null)
```

- `draggedFiles`: Tracks which files are currently being dragged
- `dropTarget`: Tracks which folder is the current drop target (for highlighting)

**Drag Start Handler:**
```typescript
const handleDragStart = (e: React.DragEvent, file: FileInfo) => {
  e.stopPropagation()

  // If file is selected, drag all selected files; otherwise just this file
  const filesToDrag = isFileSelected(file, selectedFiles)
    ? files.filter(f => selectedFiles.has(f.path))
    : [file]

  setDraggedFiles(filesToDrag)

  // Set drag data
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag.map(f => f.path)))
}
```

**Key Points:**
- Checks if dragged file is part of selection
- If yes, drags all selected files
- If no, drags only the single file
- Sets `effectAllowed` to 'move' for proper cursor
- Stores file paths in dataTransfer for potential future use

**Drag Over Handler:**
```typescript
const handleDragOver = (e: React.DragEvent, file: FileInfo) => {
  // Only allow dropping on folders
  if (file.is_directory) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(file.path)
  }
}
```

**Key Points:**
- Only accepts drops on directories
- `preventDefault()` is required to allow dropping
- Sets `dropEffect` to 'move' for proper cursor feedback
- Updates dropTarget for visual highlighting

**Drop Handler:**
```typescript
const handleDrop = (e: React.DragEvent, targetFolder: FileInfo) => {
  e.preventDefault()
  e.stopPropagation()

  if (!targetFolder.is_directory || !onMove) return

  // Don't drop on itself
  const isDroppingOnSelf = draggedFiles.some(f => f.path === targetFolder.path)
  if (isDroppingOnSelf) {
    setDropTarget(null)
    setDraggedFiles([])
    return
  }

  onMove(draggedFiles, targetFolder)
  setDropTarget(null)
  setDraggedFiles([])
}
```

**Key Points:**
- Validates drop target is a directory
- Prevents dropping folder on itself
- Calls parent's `onMove` handler
- Cleans up drag state

**Visual Feedback:**
```typescript
const isDragging = draggedFiles.some(f => f.path === file.path)
const isDroppable = dropTarget === file.path && file.is_directory

<div
  className={cn(
    'group relative flex flex-col items-center p-2 rounded-lg cursor-pointer',
    isDragging && 'opacity-50',
    isDroppable && 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
  )}
  draggable
  onDragStart={(e) => handleDragStart(e, file)}
  onDragEnd={handleDragEnd}
  onDragOver={(e) => handleDragOver(e, file)}
  onDragLeave={(e) => handleDragLeave(e, file)}
  onDrop={(e) => handleDrop(e, file)}
>
```

**Key Points:**
- `draggable` attribute makes element draggable
- `isDragging`: Makes dragged items semi-transparent (50% opacity)
- `isDroppable`: Highlights valid drop targets with blue ring
- All drag event handlers attached to each file element

#### 2. FilesPage.tsx

**Move Handler:**
```typescript
const handleMove = async (filesToMove: FileInfo[], targetFolder: FileInfo) => {
  try {
    const targetPath = joinPath(currentPath, targetFolder.name)
    for (const file of filesToMove) {
      const sourcePath = joinPath(currentPath, file.name)
      const destPath = joinPath(targetPath, file.name)
      await api.move(sourcePath, destPath)
    }
    queryClient.invalidateQueries({ queryKey: ['files'] })
    clearSelection()
    toast({ title: `Moved ${filesToMove.length} item(s)` })
  } catch (error) {
    toast({ title: 'Failed to move files', variant: 'destructive' })
  }
}
```

**Key Points:**
- Constructs full paths for source and destination
- Moves files sequentially (could be parallelized)
- Invalidates query cache to refetch directory contents
- Clears selection after move
- Shows toast notification for feedback

**Passing to Children:**
```typescript
<FileGrid
  {...props}
  onMove={handleMove}
/>
```

### Backend API

The move operation uses the existing `/api/files/move` endpoint:

```python
@router.post("/move", response_model=FileInfo)
@handle_fs_errors
async def move_file(request: FileOperation):
    return await fs_service.move(request.source, request.destination)
```

**Request Schema:**
```python
class FileOperation(BaseModel):
    source: str
    destination: str
```

### Testing Drag and Drop

**Manual Testing Checklist:**
- [ ] Drag single file onto folder
- [ ] Drag multiple selected files onto folder
- [ ] Drag folder onto another folder
- [ ] Visual feedback (opacity, highlighting) works
- [ ] Cannot drop file on itself
- [ ] Cannot drop on non-folders
- [ ] Works in grid view
- [ ] Works in list view
- [ ] Toast notification appears on success
- [ ] Error toast appears on failure
- [ ] Directory refreshes after move

---

## Keyboard Shortcuts Implementation

### Overview
Keyboard shortcuts provide quick access to common file operations using standard OS conventions (Ctrl/Cmd+C, Delete, etc.).

### Architecture

```
FilesPage
    └── useEffect (keyboard listener)
        ├── checks target element
        ├── matches key combinations
        └── calls appropriate handlers
```

### Implementation Details

#### FilesPage.tsx

**Effect Hook:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if user is typing in an input field
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      return
    }

    // Handle shortcuts...
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [/* dependencies */])
```

**Key Points:**
- Listens to `keydown` events on `window` (global shortcuts)
- Checks if focus is in an input field before processing
- Returns cleanup function to remove listener
- Dependencies array includes all handlers and state used

**Modifier Key Detection:**
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
  // Handle Ctrl+A / Cmd+A
}
```

**Key Points:**
- `e.ctrlKey`: Ctrl key on Windows/Linux
- `e.metaKey`: Cmd key on macOS
- Check both for cross-platform support
- `e.key`: The actual key pressed ('a', 'c', 'Delete', etc.)

**Preventing Default Behavior:**
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
  e.preventDefault() // Prevent browser's select all
  // Custom select all logic
}
```

**Key Points:**
- Always call `preventDefault()` for keyboard shortcuts
- Prevents browser default (e.g., Ctrl+A normally selects all text)
- Only call after confirming it's your shortcut

### Supported Shortcuts

#### Select All (Ctrl/Cmd + A)
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
  e.preventDefault()
  filteredFiles.forEach((file) => selectFile(file, { ctrlKey: true } as React.MouseEvent))
}
```
- Iterates through all files in current view
- Calls `selectFile` with `ctrlKey: true` to add to selection
- Uses filtered files (respects search and content filters)

#### Copy (Ctrl/Cmd + C)
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedFilesList.length > 0) {
  e.preventDefault()
  handleCopy(selectedFilesList)
}
```
- Only works if files are selected
- Calls existing `handleCopy` handler
- Shows toast with clipboard message

#### Cut (Ctrl/Cmd + X)
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedFilesList.length > 0) {
  e.preventDefault()
  handleCut(selectedFilesList)
}
```
- Only works if files are selected
- Calls existing `handleCut` handler
- Shows toast with clipboard message

#### Paste (Ctrl/Cmd + V)
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
  e.preventDefault()
  pasteMutation.mutate()
}
```
- Only works if clipboard has content
- Calls existing paste mutation
- Handles both copy and cut operations

#### Delete (Delete key)
```typescript
if (e.key === 'Delete' && selectedFilesList.length > 0) {
  e.preventDefault()
  setDeleteFiles(selectedFilesList)
}
```
- Only works if files are selected
- Opens delete confirmation dialog
- User must confirm deletion

#### Open (Enter key)
```typescript
if (e.key === 'Enter' && selectedFilesList.length === 1) {
  e.preventDefault()
  handleOpen(selectedFilesList[0])
}
```
- Only works with single selection
- Opens file preview or navigates to folder
- Matches single-click behavior

#### Clear Selection (Escape)
```typescript
if (e.key === 'Escape') {
  e.preventDefault()
  clearSelection()
  setSearchQuery('')
}
```
- Clears all selected files
- Also clears search query
- Resets UI to default state

#### Rename (F2)
```typescript
if (e.key === 'F2' && selectedFilesList.length === 1) {
  e.preventDefault()
  setRenameFile(selectedFilesList[0])
}
```
- Only works with single selection
- Opens rename dialog
- Standard Windows/macOS behavior

#### Navigate Up (Backspace)
```typescript
if (e.key === 'Backspace' && currentPath !== '/') {
  e.preventDefault()
  const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
  handleNavigate(parentPath)
}
```
- Only works if not at root
- Navigates to parent directory
- Computes parent by removing last path segment

### Dependencies Array

```typescript
}, [
  filteredFiles,
  selectedFilesList,
  clipboard,
  currentPath,
  selectFile,
  clearSelection,
  handleCopy,
  handleCut,
  handleOpen,
  handleNavigate,
  pasteMutation,
])
```

**Key Points:**
- Include all state and functions used in the effect
- React will re-create the listener when dependencies change
- Ensures handlers always use latest state

### Testing Keyboard Shortcuts

**Manual Testing Checklist:**
- [ ] Ctrl/Cmd+A selects all files
- [ ] Ctrl/Cmd+C copies selected files
- [ ] Ctrl/Cmd+X cuts selected files
- [ ] Ctrl/Cmd+V pastes files
- [ ] Delete deletes selected files (with confirmation)
- [ ] Enter opens single selected file
- [ ] Escape clears selection
- [ ] Escape clears search
- [ ] F2 renames single selected file
- [ ] Backspace navigates to parent
- [ ] Shortcuts disabled in input fields
- [ ] Shortcuts disabled in dialogs
- [ ] Works on Windows (Ctrl)
- [ ] Works on macOS (Cmd)
- [ ] Works on Linux (Ctrl)

---

## State Management

### Component State vs Server State

**Component State (useState):**
- UI state: `viewMode`, `gridSize`, `searchQuery`
- Transient state: `clipboard`, `uploads`, `draggedFiles`
- Dialog state: `renameFile`, `showNewFolder`, `deleteFiles`

**Server State (TanStack Query):**
- File listings: `useQuery` with key `['files', currentPath]`
- Mutations: `useMutation` for create, delete, rename, move operations

### File Selection

Managed by custom hook: `useFileSelection`

```typescript
const { selectedFiles, selectFile, clearSelection } = useFileSelection(filteredFiles)
```

**Features:**
- Maintains a `Set<string>` of selected file paths
- Handles Ctrl/Cmd+Click for multi-select
- Automatically clears when file list changes
- Provides utilities: `isFileSelected`, `getSelectedOrSingle`

### Clipboard

```typescript
interface ClipboardState {
  files: FileInfo[]
  operation: 'copy' | 'cut'
  sourcePath: string
}
```

- Stored in component state
- Cleared after cut+paste (move operation)
- Persisted after copy+paste (copy operation)
- Shows paste button when populated

---

## API Integration

### API Client (`frontend/src/api/client.ts`)

**Type-Safe Functions:**
```typescript
export const api = {
  listDirectory: (path: string) => Promise<DirectoryListing>,
  createFolder: (path: string) => Promise<void>,
  delete: (path: string) => Promise<void>,
  rename: (oldPath: string, newPath: string) => Promise<void>,
  copy: (source: string, destination: string) => Promise<void>,
  move: (source: string, destination: string) => Promise<void>,
  uploadFile: (file: File, path: string, onProgress?, relativePath?) => Promise<void>,
  getThumbnailUrl: (path: string) => string,
  getDownloadUrl: (path: string) => string,
}
```

**Error Handling:**
```typescript
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}
```

### TanStack Query Integration

**File Listing:**
```typescript
const { data: listing, isLoading, error } = useQuery({
  queryKey: ['files', currentPath],
  queryFn: () => api.listDirectory(currentPath),
})
```

**Mutations:**
```typescript
const renameMutation = useMutation({
  mutationFn: ({ oldName, newName }) =>
    api.rename(joinPath(currentPath, oldName), joinPath(currentPath, newName)),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    toast({ title: 'Renamed successfully' })
  },
  onError: () => {
    toast({ title: 'Failed to rename', variant: 'destructive' })
  },
})
```

**Key Points:**
- `queryKey` includes `currentPath` for proper caching
- `invalidateQueries` after mutations to refetch
- Toast notifications for user feedback
- Automatic retry and error handling

---

## Component Structure

### FilesPage (Main Container)

**Responsibilities:**
- State management (selection, clipboard, uploads, dialogs)
- API integration (queries and mutations)
- Event handlers (navigation, file operations)
- Keyboard shortcuts
- Layout composition

**Key State:**
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('grid')
const [gridSize, setGridSize] = useState(120)
const [searchQuery, setSearchQuery] = useState('')
const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
const [uploads, setUploads] = useState<UploadItem[]>([])
```

### FileGrid / FileList (Display Components)

**Responsibilities:**
- Rendering file items
- Drag and drop handlers
- Context menu
- Selection UI (checkboxes)

**Props Interface:**
```typescript
interface FileGridProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  gridSize: number // Only for FileGrid
  onSelect: (file: FileInfo, e: React.MouseEvent) => void
  onOpen: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPreview: (file: FileInfo) => void
  onDownload: (file: FileInfo) => void
  onMove?: (files: FileInfo[], targetFolder: FileInfo) => void
}
```

### Header (Breadcrumbs + Search)

**Responsibilities:**
- Breadcrumb navigation
- Search input
- Path display

**Props:**
```typescript
interface HeaderProps {
  path: string
  onNavigate: (path: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}
```

### Sidebar (Navigation + Filters)

**Responsibilities:**
- Favorites list
- Main folders (Home, Documents, etc.)
- Content type filters (Photos, Videos, etc.)
- Logo display

**Props:**
```typescript
interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  activeContentType: string | null
  onContentTypeChange: (type: string | null) => void
}
```

### Toolbar (Actions + View Controls)

**Responsibilities:**
- File count display
- Action buttons (copy, cut, paste, delete, refresh)
- View mode toggle
- Grid size slider
- New folder button
- Upload button

**Props:**
```typescript
interface ToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  gridSize: number
  onGridSizeChange: (size: number) => void
  itemCount: number
  selectedCount: number
  hasClipboard: boolean
  onNewFolder: () => void
  onUpload: () => void
  onUploadFolder: () => void
  onDelete: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onRefresh: () => void
}
```

---

## Adding New Features

### Adding a New Keyboard Shortcut

1. **Add handler logic in FilesPage:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // ... existing checks ...

    // New shortcut: Ctrl+D to duplicate file
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedFilesList.length === 1) {
      e.preventDefault()
      handleDuplicate(selectedFilesList[0])
    }
  }
  // ... rest of effect
}, [/* add dependencies */])
```

2. **Implement the handler:**
```typescript
const handleDuplicate = async (file: FileInfo) => {
  const newName = `${file.name} (copy)`
  const destPath = joinPath(currentPath, newName)
  await api.copy(file.path, destPath)
  queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
  toast({ title: 'File duplicated' })
}
```

3. **Update documentation:**
- Add to USAGE.md keyboard shortcuts table
- Add to README.md features list
- Add to CLAUDE.md session notes

### Adding Drag to Sidebar

Currently files can only be dragged onto folders in the main view. To add sidebar support:

1. **Add drop handlers to Sidebar component:**
```typescript
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleDrop = (e: React.DragEvent, targetPath: string) => {
  e.preventDefault()
  const dragData = e.dataTransfer.getData('text/plain')
  if (dragData && onMove) {
    const filePaths = JSON.parse(dragData)
    onMove(filePaths, targetPath)
  }
}
```

2. **Apply to sidebar items:**
```typescript
<div
  onDragOver={handleDragOver}
  onDrop={(e) => handleDrop(e, folder.path)}
>
  {folder.name}
</div>
```

3. **Update FilesPage to handle cross-directory moves:**
```typescript
const handleMove = async (filePaths: string[], targetPath: string) => {
  // Move files from any source to any destination
  for (const sourcePath of filePaths) {
    const fileName = sourcePath.split('/').pop()
    const destPath = joinPath(targetPath, fileName)
    await api.move(sourcePath, destPath)
  }
  queryClient.invalidateQueries({ queryKey: ['files'] })
}
```

### Adding Arrow Key Navigation

To navigate files with arrow keys:

1. **Add focus management state:**
```typescript
const [focusedIndex, setFocusedIndex] = useState(0)
```

2. **Add arrow key handlers:**
```typescript
if (e.key === 'ArrowDown') {
  e.preventDefault()
  setFocusedIndex((i) => Math.min(i + 1, filteredFiles.length - 1))
}

if (e.key === 'ArrowUp') {
  e.preventDefault()
  setFocusedIndex((i) => Math.max(i - 1, 0))
}
```

3. **Scroll focused item into view:**
```typescript
useEffect(() => {
  const focusedElement = document.querySelector(`[data-file-index="${focusedIndex}"]`)
  focusedElement?.scrollIntoView({ block: 'nearest' })
}, [focusedIndex])
```

4. **Add focus styling to FileGrid/FileList:**
```typescript
<div
  data-file-index={index}
  className={cn(
    'file-item',
    index === focusedIndex && 'ring-2 ring-primary'
  )}
>
```

### Adding Backend Endpoint

1. **Define Pydantic model in `backend/app/models/schemas.py`:**
```python
class DuplicateRequest(BaseModel):
    source: str
```

2. **Add endpoint in `backend/app/routers/files.py`:**
```python
@router.post("/duplicate", response_model=FileInfo)
@handle_fs_errors
async def duplicate_file(request: DuplicateRequest):
    return await fs_service.duplicate(request.source)
```

3. **Implement in `backend/app/services/filesystem.py`:**
```python
async def duplicate(self, source: str) -> FileInfo:
    src_path = self.get_absolute_path(source)
    dest_path = self._get_unique_name(src_path)
    shutil.copy2(src_path, dest_path)
    return await self.get_file_info(str(dest_path))
```

4. **Add to frontend API client:**
```typescript
async function duplicate(source: string): Promise<void> {
  await handleResponse(
    await fetch(`${API_BASE}/files/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
  )
}

export const api = {
  // ... existing methods
  duplicate,
}
```

---

## Performance Considerations

### Drag and Drop
- Drag handlers are added to every file element
- No performance issues with hundreds of files
- If needed, could virtualize grid/list with react-window

### Keyboard Shortcuts
- Single global event listener (efficient)
- Dependencies array ensures handlers are up-to-date
- Early return for input fields prevents unnecessary processing

### File Selection
- Uses Set<string> for O(1) lookup
- Only re-renders affected components
- Memoized selectedFilesList derived from Set

### Query Caching
- TanStack Query caches listings by path
- Navigation between folders is instant
- Invalidation only when mutations occur

---

## Testing

### Manual Testing Script

Create `test-features.md`:
```markdown
# Drag and Drop Tests
- [ ] Grid: Drag single file to folder
- [ ] Grid: Drag multiple files to folder
- [ ] List: Drag single file to folder
- [ ] List: Drag multiple files to folder
- [ ] Cannot drag to non-folder
- [ ] Cannot drag folder to itself
- [ ] Visual feedback works
- [ ] Toast notification on success
- [ ] Error handling on failure

# Keyboard Shortcut Tests
- [ ] Ctrl/Cmd+A selects all
- [ ] Ctrl/Cmd+C copies
- [ ] Ctrl/Cmd+X cuts
- [ ] Ctrl/Cmd+V pastes
- [ ] Delete shows confirmation
- [ ] Enter opens file
- [ ] Escape clears selection
- [ ] F2 renames file
- [ ] Backspace navigates up
- [ ] Shortcuts disabled in inputs
```

### Automated Testing

Currently no automated tests. To add:

1. **Install Vitest:**
```bash
npm install -D vitest @testing-library/react @testing-library/user-event
```

2. **Create test file:**
```typescript
// FileGrid.test.tsx
import { render, screen } from '@testing-library/react'
import { FileGrid } from './FileGrid'

describe('FileGrid', () => {
  it('renders files', () => {
    render(<FileGrid files={mockFiles} {...mockProps} />)
    expect(screen.getByText('test.txt')).toBeInTheDocument()
  })
})
```

3. **Add test script to package.json:**
```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

---

## Debugging Tips

### Drag and Drop Issues

**Check drag state:**
```typescript
console.log('Drag started:', draggedFiles)
console.log('Drop target:', dropTarget)
```

**Check event data:**
```typescript
onDragOver={(e) => {
  console.log('Drag over:', file.name, e.dataTransfer.effectAllowed)
  handleDragOver(e, file)
}}
```

**Common issues:**
- Forgot `e.preventDefault()` in dragOver → drop won't work
- Missing `draggable` attribute → element not draggable
- Wrong `effectAllowed` → incorrect cursor feedback

### Keyboard Shortcut Issues

**Check key detection:**
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  console.log('Key:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey)
  // ... handlers
}
```

**Check input detection:**
```typescript
const target = e.target as HTMLElement
console.log('Target:', target.tagName, target.contentEditable)
```

**Common issues:**
- Forgot `e.preventDefault()` → browser default action occurs
- Wrong key name → use `e.key` not `e.keyCode`
- Forgot to add dependency → handler uses stale state

### React DevTools

Install React DevTools browser extension:
- Inspect component props and state
- Track re-renders with profiler
- Check hooks (especially useEffect dependencies)

---

## Code Style

### TypeScript
- Use explicit types for function parameters
- Use type inference for local variables
- Prefer interfaces for objects with properties
- Prefer type aliases for unions and primitives

### React
- Use functional components with hooks
- Extract complex logic into custom hooks
- Keep components under 300 lines
- Use early returns for readability

### Naming
- Components: PascalCase (`FileGrid`)
- Functions/variables: camelCase (`handleMove`)
- Constants: UPPER_SNAKE_CASE (`API_BASE`)
- Files: Match component name (`FileGrid.tsx`)

### Event Handlers
- Prefix with `handle`: `handleClick`, `handleDragStart`
- Prefix callbacks with `on`: `onClick`, `onDragStart`
- Pass callbacks as props: `<Child onEvent={handleEvent} />`

---

## Future Improvements

### Performance
- Virtualize file grid for thousands of files
- Debounce search input
- Lazy load thumbnails
- Cache thumbnail URLs

### Features
- Undo/redo file operations
- Batch operations with progress
- File archiving (zip/unzip)
- Custom thumbnail cache sizes
- Favorites management
- Recursive content search

### Developer Experience
- Unit tests for components
- Integration tests for file operations
- E2E tests with Playwright
- Storybook for component development
- ESLint + Prettier configuration
- Husky pre-commit hooks

---

## Resources

- [React DnD Documentation](https://react-dnd.github.io/react-dnd/)
- [HTML5 Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
