from collections.abc import Callable, Iterable
from typing import Any

from app.models.track import Track
from app.services.embeddings.embedding_models import TrackEmbeddingInput
from app.services.embeddings.tag_embedding_matcher import build_track_embedding_text


Embedding = Any
EmbeddingEncoder = Callable[[list[str]], Iterable[Embedding]]


def _numeric_value(track: Track, field_name: str) -> float | None:
    value = getattr(track, field_name, None)

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def track_to_embedding_input(track: Track) -> TrackEmbeddingInput:
    existing_tags: list[str] = []

    for track_tag in getattr(track, "track_tags", []) or []:
        tag = getattr(track_tag, "tag", None)
        tag_name = getattr(tag, "name", None)

        if tag_name:
            existing_tags.append(tag_name)

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
        bpm=_numeric_value(track, "bpm"),
        energy_label=getattr(track, "energy_label", None),
        loudness=_numeric_value(track, "loudness_db"),
    )


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

    def preload(self, tracks: Iterable[Track]) -> None:
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
            text = build_track_embedding_text(track_to_embedding_input(track))

            if not text.strip():
                continue

            texts.append(text)
            tracks_to_encode.append(track)

        if not texts:
            return

        embeddings = self._encoder(texts)

        for track, embedding in zip(tracks_to_encode, embeddings):
            self.set(track, embedding)
