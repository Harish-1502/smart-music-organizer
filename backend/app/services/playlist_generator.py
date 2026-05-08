from sqlalchemy.orm import Session

from app.models.track import Track
from app.models.tag import Tag
from app.models.track_tag import TrackTag
import re

SOURCE_WEIGHT = {
    "manual": 1.25,
    "metadata": 1.15,
    "lastfm": 1.10,
    "musicbrainz": 1.05,
    "rule": 1.00,
}


def score_track(track_tags, include_tags, exclude_tags):
    score = 0

    for track_tag in track_tags:
        tag_name = track_tag.tag.name
        source_weight = SOURCE_WEIGHT.get(track_tag.source, 1.0)

        if tag_name in include_tags:
            score += 10 * track_tag.confidence * source_weight

        if tag_name in exclude_tags:
            score -= 100

    return score


def generate_tracks_from_rules(
    db: Session,
    include_tags: list[str],
    exclude_tags: list[str],
    limit: int = 20,
):
    tracks = (
        db.query(Track)
        .join(TrackTag, Track.id == TrackTag.track_id)
        .join(Tag, TrackTag.tag_id == Tag.id)
        .filter(Tag.name.in_(include_tags))
        .distinct()
        .all()
    )

    scored_tracks = []

    for track in tracks:
        score = score_track(
            track.track_tags,
            include_tags=include_tags,
            exclude_tags=exclude_tags,
        )

        if score > 0:
            scored_tracks.append((track, score))

    scored_tracks.sort(key=lambda item: item[1], reverse=True)

    return [track for track, score in scored_tracks[:limit]]

def get_match_info(track_tags, include_tags, exclude_tags):
    score = 0
    matched_tags = set()
    excluded_matches = set()

    for track_tag in track_tags:
        tag_name = track_tag.tag.name
        source_weight = SOURCE_WEIGHT.get(track_tag.source, 1.0)

        if tag_name in include_tags:
            score += 10 * track_tag.confidence * source_weight
            matched_tags.add(tag_name)

        if tag_name in exclude_tags:
            excluded_matches.add(tag_name)

    if excluded_matches:
        score -= 100

    return score, matched_tags, excluded_matches

def apply_playlist_duration_limit(
    scored_tracks: list[tuple[Track, float]],
    max_duration_seconds: int | None,
) -> list[tuple[Track, float]]:
    """
    Keep adding scored tracks until the playlist reaches the requested duration.

    Tracks with missing duration are skipped when a time limit exists because
    they could accidentally make the playlist much longer than requested.
    """

    if max_duration_seconds is None:
        return scored_tracks

    selected = []
    total_duration = 0.0

    for track, score in scored_tracks:
        if track.duration is None:
            continue

        next_total = total_duration + float(track.duration)

        if next_total > max_duration_seconds:
            continue

        selected.append((track, score))
        total_duration = next_total

    return selected

def generate_scored_tracks_from_rules(
    db: Session,
    include_tags: list[str],
    exclude_tags: list[str],
    limit: int = 20,
):
    tracks = (
        db.query(Track)
        .join(TrackTag, Track.id == TrackTag.track_id)
        .join(Tag, TrackTag.tag_id == Tag.id)
        .filter(Tag.name.in_(include_tags))
        .distinct()
        .all()
    )

    scored_tracks = []

    for track in tracks:
        score, matched_tags, excluded_matches = get_match_info(
            track.track_tags,
            include_tags=include_tags,
            exclude_tags=exclude_tags,
        )

        if excluded_matches:
            continue

        # Previously we required a track to match at least two include tags
        # when multiple include tags were provided. This was too strict and
        # often returned no results when the database only had one matching
        # tag (for example: tracks tagged only with "chill"). Prefer scoring
        # and ranking by matches instead of filtering them out entirely.

        if score > 0:
            scored_tracks.append((track, score))

    scored_tracks.sort(key=lambda item: item[1], reverse=True)

    return scored_tracks[: max(limit * 3, limit)]

def generate_playlist_name_from_prompt(prompt: str) -> str:
    """
    Generate a readable playlist name from the user's prompt.

    This is intentionally simple for V1.
    Later, you can make this smarter using parsed tags.
    """

    cleaned = prompt.lower().strip()

    # Remove common filler words.
    cleaned = re.sub(
        r"\b(make|create|generate|give|me|a|an|the|playlist|songs|music|for|with)\b",
        " ",
        cleaned,
    )

    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if not cleaned:
        return "AI Playlist"

    # Keep name short.
    words = cleaned.split()[:5]
    name = " ".join(words).title()

    return f"{name} Mix"

def make_unique_playlist_name(db: Session, base_name: str) -> str:
    from app.models.playlist import Playlist

    existing = db.query(Playlist).filter(Playlist.name == base_name).first()

    if not existing:
        return base_name

    counter = 2

    while True:
        candidate = f"{base_name} {counter}"
        existing = db.query(Playlist).filter(Playlist.name == candidate).first()

        if not existing:
            return candidate

        counter += 1