"""Error handling utilities for FastAPI endpoints."""

from functools import wraps
from fastapi import HTTPException
from typing import Callable, Any
import inspect


def handle_fs_errors(func: Callable) -> Callable:
    """
    Decorator that handles common filesystem exceptions and converts them to appropriate HTTP exceptions.

    Handles:
    - FileNotFoundError -> 404
    - NotADirectoryError -> 400
    - PermissionError -> 403
    - ValueError -> 400
    - FileExistsError -> 409
    """

    @wraps(func)
    async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return await func(*args, **kwargs)
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except NotADirectoryError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except FileExistsError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @wraps(func)
    def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except NotADirectoryError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except FileExistsError as e:
            raise HTTPException(status_code=409, detail=str(e))

    # Return async wrapper for async functions, sync wrapper for sync functions
    if inspect.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper
