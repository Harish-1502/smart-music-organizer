from pathlib import Path
import logging

from sqlalchemy.orm import Session

from app.core.path_guard import PathSecurityError, is_within_directory, safe_resolve_path
from app.models.track import Track

logger = logging.getLogger(__name__)


def _track_is_inside_root(track: Track, root: Path) -> bool:
    try:
        return is_within_directory(track.file_path, root)
    except (OSError, RuntimeError, PathSecurityError):
        return False


def _tracks_inside_root(db: Session, root: Path) -> list[Track]:
    return [
        track
        for track in db.query(Track).all()
        if _track_is_inside_root(track, root)
    ]


def cleanup_stale_tracks(
    db: Session,
    root: Path,
    root_str: str,
    seen_paths: set[str],
    supported_found: int,
) -> tuple[int | None, Exception | None]:
    logger.debug(
        "Starting stale cleanup: supported_found=%s seen_paths=%s",
        supported_found,
        len(seen_paths),
    )
    if not seen_paths:
        logger.warning(
            "Stale cleanup skipped because no supported audio files were found."
        )
        return 0, None

    resolved_root = safe_resolve_path(root, reject_parent_refs=False)
    tracks_inside_root = _tracks_inside_root(db, resolved_root)
    stale_list = [
        track
        for track in tracks_inside_root
        if track.file_path not in seen_paths
    ]

    logger.debug("Stale cleanup candidate count: %s", len(stale_list))
    for track in stale_list[:10]:
        logger.debug(
            "Stale cleanup candidate=%s real_inside_root=%s",
            track.file_path,
            True,
        )

    try:
        deleted = 0
        for track in stale_list:
            db.delete(track)
            deleted += 1

        logger.debug("Stale cleanup delete returned: %s", deleted)
        db.commit()
        logger.debug(
            "Tracks under scan root after stale cleanup: %s",
            len(_tracks_inside_root(db, resolved_root)),
        )
        return deleted, None
    except Exception as exc:
        db.rollback()
        return None, exc
