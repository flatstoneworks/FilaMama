from pydantic import BaseModel
from typing import Optional, List
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
    size: int
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
    path: str
    new_name: str


class DeleteRequest(BaseModel):
    paths: List[str]


class CreateDirectoryRequest(BaseModel):
    path: str
    name: str


class SearchResult(BaseModel):
    path: str
    name: str
    type: FileType
    size: int
    modified: datetime


class SearchResponse(BaseModel):
    results: list[SearchResult]
    has_more: bool
    total_scanned: int  # How many items were scanned before hitting limit


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
