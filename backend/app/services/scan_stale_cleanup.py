from pathlib import Path
import logging

from sqlalchemy.orm import Session

from app.models.track import Track

logger = logging.getLogger(__name__)


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

    stale_tracks = db.query(Track).filter(Track.file_path.startswith(root_str))
    if seen_paths:
        stale_tracks = stale_tracks.filter(~Track.file_path.in_(seen_paths))

    stale_list = stale_tracks.all()

    logger.debug("Stale cleanup candidate count: %s", len(stale_list))
    for track in stale_list[:10]:
        candidate = Path(track.file_path)
        real_inside_root = candidate == root or root in candidate.parents
        logger.debug(
            "Stale cleanup candidate=%s real_inside_root=%s",
            track.file_path,
            real_inside_root,
        )

    try:
        stale_query = db.query(Track).filter(Track.file_path.startswith(root_str))

        if seen_paths:
            stale_query = stale_query.filter(~Track.file_path.in_(seen_paths))

        deleted = stale_query.delete(synchronize_session=False)
        logger.debug("Stale cleanup delete returned: %s", deleted)
        db.commit()
        logger.debug(
            "Tracks under scan root after stale cleanup: %s",
            db.query(Track).filter(Track.file_path.startswith(root_str)).count(),
        )
        return deleted, None
    except Exception as exc:
        db.rollback()
        return None, exc
