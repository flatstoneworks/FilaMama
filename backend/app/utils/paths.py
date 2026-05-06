"""Shared path utilities for filesystem services.

Centralizes path resolution, bounds checking, and collision-resolving
rename logic so every service applies the same security rules.
"""

from pathlib import Path
from typing import Iterable, Optional


def resolve_within_root(
    path: str,
    root: Path,
    mounts: Optional[Iterable[Path]] = None,
) -> Path:
    """Resolve a user-supplied path against ``root`` (or one of ``mounts``)
    and verify the result stays within bounds.

    If ``path`` matches one of the mount points (by absolute prefix), it is
    resolved against that mount; otherwise it is treated as relative to
    ``root`` (a leading ``/`` is stripped first).

    Raises:
        ValueError: if the resolved path escapes its root/mount.
    """
    if mounts:
        for mount in mounts:
            mount_str = str(mount)
            if path == mount_str or path.startswith(mount_str + "/"):
                full_path = Path(path).resolve()
                try:
                    full_path.relative_to(mount)
                except ValueError:
                    raise ValueError("Path traversal attempt detected")
                return full_path

    if path.startswith("/"):
        path = path[1:]
    full_path = (root / path).resolve()
    try:
        full_path.relative_to(root)
    except ValueError:
        raise ValueError("Path traversal attempt detected")
    return full_path


def relative_to_root(
    absolute_path: Path,
    root: Path,
    mounts: Optional[Iterable[Path]] = None,
) -> str:
    """Convert an absolute path back to the public API path form.

    Paths inside ``root`` are returned as ``/relative/sub/path`` (with the
    root itself becoming ``/``). Paths inside a mount are returned as the
    full absolute path (matching how mounts are addressed in requests).
    """
    resolved_path = absolute_path.resolve()
    if mounts:
        for mount in mounts:
            try:
                resolved_path.relative_to(mount)
                return str(resolved_path)
            except ValueError:
                continue
    try:
        rel = str(resolved_path.relative_to(root))
        if rel == ".":
            return "/"
        return "/" + rel
    except ValueError:
        return "/"


def generate_unique_path(dest: Path) -> Path:
    """Return a non-colliding destination path.

    If ``dest`` does not exist it is returned unchanged. Otherwise, an
    incrementing ``(N)`` suffix is appended before the extension until a
    free name is found (e.g. ``foo.txt`` → ``foo(1).txt`` → ``foo(2).txt``).
    """
    if not dest.exists():
        return dest
    base = dest.stem
    ext = dest.suffix
    parent = dest.parent
    counter = 1
    while True:
        candidate = parent / f"{base}({counter}){ext}"
        if not candidate.exists():
            return candidate
        counter += 1
