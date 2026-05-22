from __future__ import annotations

from app.core.config import settings


def is_public_art_reference(value: str | None) -> bool:
    if not value:
        return False

    normalized = value.strip().lower()
    return (
        normalized.startswith("http://")
        or normalized.startswith("https://")
        or normalized.startswith("/static/")
    )


def expose_local_path(value: str | None) -> str | None:
    if settings.expose_local_paths:
        return value

    return None


def expose_art_path(value: str | None) -> str | None:
    if settings.expose_local_paths:
        return value

    if is_public_art_reference(value):
        return value

    return None
