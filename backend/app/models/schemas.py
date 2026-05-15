from pydantic import BaseModel, Field
from typing import Optional, List, Any
from enum import Enum
from datetime import datetime


class FileType(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"
    SYMLINK = "symlink"


class SortField(str, Enum):
    NAME = "name"
    SIZE = "size"
    MODIFIED = "modified"
    TYPE = "type"


class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"


class FileInfo(BaseModel):
    name: str
    path: str
    type: FileType
    size: int = Field(ge=0)
    modified: datetime
    extension: Optional[str] = None
    mime_type: Optional[str] = None
    is_hidden: bool = False
    has_thumbnail: bool = False


class DirectoryListing(BaseModel):
    path: str
    parent: Optional[str]
    items: List[FileInfo]
    total_items: int
    total_size: int


class DiskUsage(BaseModel):
    total: int
    used: int
    free: int
    percent: float


class FileOperation(BaseModel):
    source: str
    destination: str
    overwrite: bool = False  # If True, replace existing files; if False, auto-rename


class ConflictCheckRequest(BaseModel):
    sources: List[str]  # List of source file paths
    destination: str    # Destination directory


class ConflictCheckResponse(BaseModel):
    conflicts: List[str]  # List of source paths that would conflict


class RenameRequest(BaseModel):
    path: str = Field(min_length=1)
    new_name: str = Field(min_length=1, max_length=255)


class DeleteRequest(BaseModel):
    paths: List[str] = Field(min_length=1, max_length=10000)


class CreateDirectoryRequest(BaseModel):
    path: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=255)


class SearchResult(BaseModel):
    path: str
    name: str
    type: FileType
    size: int
    modified: datetime
    match_reason: Optional[str] = None


class SearchResponse(BaseModel):
    results: list[SearchResult]
    has_more: bool
    total_scanned: int  # How many items were scanned before hitting limit


class ContentSearchMatch(BaseModel):
    path: str
    name: str
    line_number: int
    line_content: str  # The matching line with context


class ContentSearchResult(BaseModel):
    path: str
    name: str
    type: FileType
    size: int
    modified: datetime
    matches: list[ContentSearchMatch]  # All matches in this file


class ContentSearchResponse(BaseModel):
    results: list[ContentSearchResult]
    files_searched: int
    files_with_matches: int
    has_more: bool


class UploadProgress(BaseModel):
    filename: str
    bytes_uploaded: int
    total_bytes: int
    percent: float
    status: str


class DeleteResponse(BaseModel):
    deleted: int


class TextFileContent(BaseModel):
    content: str
    size: int


class OperationSuccess(BaseModel):
    success: bool
    message: Optional[str] = None


class ActorType(str, Enum):
    HUMAN = "human"
    AGENT = "agent"


class Actor(BaseModel):
    id: str = "local-user"
    type: ActorType = ActorType.HUMAN
    name: str = "Local user"


class ArtifactMetadataInput(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    source_type: Optional[str] = None
    source_url: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    prompt_summary: Optional[str] = None
    labels: List[str] = Field(default_factory=list, max_length=100)
    task_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentTextArtifactRequest(BaseModel):
    path: str = Field(min_length=1)
    content: str
    metadata: ArtifactMetadataInput = Field(default_factory=ArtifactMetadataInput)


class AgentFolderRequest(BaseModel):
    path: str = Field(min_length=1)
    metadata: ArtifactMetadataInput = Field(default_factory=ArtifactMetadataInput)


class TaskStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskCreateRequest(BaseModel):
    path: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.OPEN


class TaskPatchRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    path: Optional[str] = None


class NoteCreateRequest(BaseModel):
    path: str = Field(min_length=1)
    body: str = Field(min_length=1)


class LeaseCreateRequest(BaseModel):
    path: str = Field(min_length=1)
    purpose: str = Field(min_length=1, max_length=500)
    expires_at: Optional[datetime] = None


class ProposalOperation(str, Enum):
    CREATE_FOLDER = "create_folder"
    WRITE_TEXT = "write_text"
    RENAME = "rename"
    MOVE = "move"
    COPY = "copy"
    TRASH = "trash"


class ProposalCreateRequest(BaseModel):
    operation: ProposalOperation
    paths: List[str] = Field(min_length=1, max_length=1000)
    params: dict[str, Any] = Field(default_factory=dict)
    summary: Optional[str] = None


class ProposalRejectRequest(BaseModel):
    reason: Optional[str] = None
