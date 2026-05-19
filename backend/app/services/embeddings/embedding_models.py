from dataclasses import dataclass


@dataclass(frozen=True)
class TrackEmbeddingInput:
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    filename: str | None = None
    folder_path: str | None = None
    existing_tags: list[str] | None = None
    bpm: float | None = None
    energy_label: str | None = None
    loudness: float | None = None