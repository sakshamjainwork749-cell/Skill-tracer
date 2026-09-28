from __future__ import annotations

from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel


def success(data: Any, status_code: int = 200) -> JSONResponse:
    if isinstance(data, BaseModel):
        data = data.model_dump(mode="json")
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": jsonable_encoder(data)},
    )
