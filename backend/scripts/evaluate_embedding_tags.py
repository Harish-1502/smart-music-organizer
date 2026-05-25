import argparse
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.models.tag import Tag
from app.services.embeddings.embedding_models import TrackEmbeddingInput

try:
    from app.services.embeddings.tag_embedding_matcher import (
        generate_embedding_tag_candidates,
    )
except ModuleNotFoundError as error:
    if error.name == "sentence_transformers":
        raise SystemExit(
            "sentence-transformers is required to evaluate embedding tags. "
            "Install backend requirements before running this script."
        ) from error

    raise


def _first_present(*values) -> str | None:
    for value in values:
        if value:
            return str(value)

    return None


def _existing_tag_names(track: Track) -> list[str]:
    tag_names = []

    for track_tag in track.track_tags or []:
        tag = track_tag.tag

        if tag and tag.name:
            tag_names.append(tag.name)

    return sorted(tag_names)


def _to_embedding_input(track: Track) -> TrackEmbeddingInput:
    return TrackEmbeddingInput(
        title=_first_present(track.display_title, track.title, track.scanned_title),
        artist=_first_present(track.display_artist, track.artist, track.scanned_artist),
        album=_first_present(track.display_album, track.album, track.scanned_album),
        filename=track.file_name,
        folder_path=track.folder_path,
        existing_tags=_existing_tag_names(track),
        bpm=track.bpm,
        energy_label=track.energy_label,
    )


def _print_track_candidates(track: Track) -> None:
    existing_tags = _existing_tag_names(track)
    embedding_input = _to_embedding_input(track)
    candidates = generate_embedding_tag_candidates(embedding_input)

    title = embedding_input.title or "Unknown title"
    artist = embedding_input.artist or "Unknown artist"
    existing_tag_text = ", ".join(existing_tags) if existing_tags else "None"

    print(f"Track ID: {track.id}")
    print(f"Title: {title}")
    print(f"Artist: {artist}")
    print(f"File: {track.file_name}")
    print(f"Existing tags: {existing_tag_text}")
    print("Top embedding candidates:")

    if not candidates:
        print("  None")
    else:
        for candidate in candidates:
            print(f"  - {candidate.tag_name}: {candidate.confidence:.3f}")

    print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate embedding tag candidates on a read-only track sample.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=25,
        help="Number of tracks to sample. Defaults to 25.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    limit = max(1, args.limit)

    db = SessionLocal()

    try:
        tracks = (
            db.query(Track)
            .options(selectinload(Track.track_tags).selectinload(TrackTag.tag))
            .order_by(Track.id.asc())
            .limit(limit)
            .all()
        )

        if not tracks:
            print("No tracks found.")
            return

        for track in tracks:
            _print_track_candidates(track)

    finally:
        db.close()


if __name__ == "__main__":
    main()
