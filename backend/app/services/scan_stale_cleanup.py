from pathlib import Path

from sqlalchemy.orm import Session

from app.models.track import Track


def cleanup_stale_tracks(
    db: Session,
    root: Path,
    root_str: str,
    seen_paths: set[str],
    supported_found: int,
) -> tuple[int | None, Exception | None]:
    print(
        f"[DEBUG scan_library:cleanup] supported_found={supported_found} "
        f"seen_paths={len(seen_paths)}"
    )
    if not seen_paths:
        print(
            f"[DEBUG scan_library:cleanup] WARNING seen_paths is empty for root={root_str}; "
            "cleanup skipped because no supported audio files were found"
        )
        return 0, None

    stale_tracks = db.query(Track).filter(Track.file_path.startswith(root_str))
    if seen_paths:
        stale_tracks = stale_tracks.filter(~Track.file_path.in_(seen_paths))

    stale_list = stale_tracks.all()

    print(f"[DEBUG scan_library:cleanup] stale_count={len(stale_list)}")
    for track in stale_list[:10]:
        candidate = Path(track.file_path)
        real_inside_root = candidate == root or root in candidate.parents
        print(
            f"[DEBUG scan_library:cleanup] stale_candidate={track.file_path} "
            f"real_inside_root={real_inside_root}"
        )

    try:
        stale_query = db.query(Track).filter(Track.file_path.startswith(root_str))

        if seen_paths:
            stale_query = stale_query.filter(~Track.file_path.in_(seen_paths))

        deleted = stale_query.delete(synchronize_session=False)
        print(f"[DEBUG scan_library:cleanup] delete_returned={deleted}")
        db.commit()
        print(
            f"[DEBUG scan_library:cleanup] tracks_under_root_after="
            f"{db.query(Track).filter(Track.file_path.startswith(root_str)).count()}"
        )
        return deleted, None
    except Exception as exc:
        db.rollback()
        return None, exc
