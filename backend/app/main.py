from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.config import get_settings
from app.core.responses import success
from app.db.session import Base, engine

logger = logging.getLogger(__name__)

DESCRIPTION = """
SkillTrace API prototype.

Demo credentials (created automatically for the zero-configuration demo):
- TRAINEE: trainee@skilltrace.in / Demo@123
- EMPLOYER: employer@skilltrace.in / Demo@123
- GOVERNMENT_ADMIN: admin@skilltrace.in / Demo@123

Successful responses use `{ "success": true, "data": ... }`; errors use
`{ "detail": "..." }`.
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.resolved_upload_dir.mkdir(parents=True, exist_ok=True)
    if settings.auto_create_tables:
        # Importing all model modules registers them on Base.metadata.
        from app import models  # noqa: F401

        Base.metadata.create_all(bind=engine)
    if settings.auto_seed_demo:
        from app.db.seed import seed_database

        seed_database(engine)
    # Lightweight local follow-up delivery loop (no Celery/Redis required).
    try:
        from app.services.followup_scheduler import start_scheduler_loop

        start_scheduler_loop()
    except Exception:
        logger.exception("Could not start follow-up scheduler")
    yield


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    _: Request, exc: StarletteHTTPException
) -> JSONResponse:
    detail = exc.detail
    if not isinstance(detail, str):
        detail = str(detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    issues: list[str] = []
    for error in exc.errors():
        location = ".".join(str(item) for item in error.get("loc", ())) or "request"
        issues.append(f"{location}: {error.get('msg', 'invalid value')}")
    return JSONResponse(
        status_code=422,
        content={"detail": f"Validation failed: {'; '.join(issues)}"},
    )


@app.exception_handler(IntegrityError)
async def integrity_exception_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("Database integrity error: %s", exc)
    return JSONResponse(
        status_code=409, content={"detail": "Database constraint conflict"}
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled request error for %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health", tags=["System"])
@app.get(f"{settings.api_v1_prefix}/health", include_in_schema=False)
def health():
    return success(
        {"status": "ok", "service": settings.app_name, "version": settings.app_version}
    )


app.include_router(api_router, prefix=settings.api_v1_prefix)
