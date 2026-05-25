from collections.abc import Callable, Iterable
from typing import Any

from app.models.track import Track
from app.services.embeddings.embedding_models import TrackEmbeddingInput


Embedding = Any
EmbeddingEncoder = Callable[[list[str]], Iterable[Embedding]]

SUBJECTIVE_REFERENCE_TAGS = {
    "workout",
    "study",
    "chill",
    "party",
    "driving",
    "high_energy",
    "low_energy",
}


def _numeric_value(track: Track, field_name: str) -> float | None:
    value = getattr(track, field_name, None)

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_existing_tag_names(
    track: Track,
    *,
    exclude_tag_name: str | None = None,
) -> list[str]:
    existing_tags: list[str] = []
    normalized_excluded_tag = (exclude_tag_name or "").strip().lower()

    for track_tag in getattr(track, "track_tags", []) or []:
        tag = getattr(track_tag, "tag", None)
        tag_name = getattr(tag, "name", None)

        if not tag_name:
            continue

        normalized_tag_name = tag_name.strip().lower()

        if normalized_tag_name == normalized_excluded_tag:
            continue

        if normalized_tag_name in SUBJECTIVE_REFERENCE_TAGS:
            continue

        existing_tags.append(tag_name)

    return existing_tags


def track_to_embedding_input(
    track: Track,
    *,
    include_audio_descriptors: bool = True,
    exclude_tag_name: str | None = None,
) -> TrackEmbeddingInput:
    existing_tags = _safe_existing_tag_names(
        track,
        exclude_tag_name=exclude_tag_name,
    )
    bpm = _numeric_value(track, "bpm") if include_audio_descriptors else None
    energy_label = (
        getattr(track, "energy_label", None) if include_audio_descriptors else None
    )
    loudness = (
        _numeric_value(track, "loudness_db") if include_audio_descriptors else None
    )

    return TrackEmbeddingInput(
        title=getattr(track, "display_title", None)
        or getattr(track, "title", None)
        or getattr(track, "scanned_title", None),
        artist=getattr(track, "display_artist", None)
        or getattr(track, "artist", None)
        or getattr(track, "scanned_artist", None),
        album=getattr(track, "display_album", None)
        or getattr(track, "album", None)
        or getattr(track, "scanned_album", None),
        file_name=getattr(track, "file_name", None),
        folder_path=getattr(track, "folder_path", None),
        existing_tags=existing_tags or None,
        bpm=bpm,
        energy_label=energy_label,
        loudness=loudness,
    )


def build_reference_embedding_text(
    track: Track,
    *,
    exclude_tag_name: str | None = None,
) -> str:
    embedding_input = track_to_embedding_input(
        track,
        include_audio_descriptors=False,
        exclude_tag_name=exclude_tag_name,
    )
    parts: list[str] = []

    if embedding_input.title:
        parts.append(f"Title: {embedding_input.title}")
    if embedding_input.artist:
        parts.append(f"Artist: {embedding_input.artist}")
    if embedding_input.album:
        parts.append(f"Album: {embedding_input.album}")

    filename = embedding_input.filename or embedding_input.file_name

    if filename:
        parts.append(f"Filename: {filename}")
    if embedding_input.existing_tags:
        parts.append(f"Existing tags: {', '.join(embedding_input.existing_tags)}")

    return ". ".join(parts)


def _default_encode_texts(texts: list[str]):
    from app.services.embeddings.embedding_service import encode_texts

    return encode_texts(texts)


class TrackEmbeddingRequestCache:
    def __init__(self, encoder: EmbeddingEncoder | None = None):
        self._encoder = encoder or _default_encode_texts
        self._embeddings: dict[int, Embedding] = {}

    def get(self, track: Track):
        track_id = getattr(track, "id", None)

        if track_id is None:
            return None

        return self._embeddings.get(track_id)

    def set(self, track: Track, embedding) -> None:
        track_id = getattr(track, "id", None)

        if track_id is None:
            return

        self._embeddings[track_id] = embedding

    def preload(
        self,
        tracks: Iterable[Track],
        *,
        exclude_tag_name: str | None = None,
    ) -> None:
        missing_tracks_by_id: dict[int, Track] = {}

        for track in tracks:
            if track is None:
                continue

            track_id = getattr(track, "id", None)

            if track_id is None or track_id in self._embeddings:
                continue

            missing_tracks_by_id.setdefault(track_id, track)

        texts: list[str] = []
        tracks_to_encode: list[Track] = []

        for track in missing_tracks_by_id.values():
            text = build_reference_embedding_text(
                track,
                exclude_tag_name=exclude_tag_name,
            )

            if not text.strip():
                continue

            texts.append(text)
            tracks_to_encode.append(track)

        if not texts:
            return

        embeddings = self._encoder(texts)

        for track, embedding in zip(tracks_to_encode, embeddings):
            self.set(track, embedding)
