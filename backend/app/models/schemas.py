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
    width: Optional[int] = None
    height: Optional[int] = None
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
    match_context: Optional[str] = None


class UploadProgress(BaseModel):
    filename: str
    bytes_uploaded: int
    total_bytes: int
    percent: float
    status: str
