import numpy as np

from app.services.embeddings.embedding_models import TrackEmbeddingInput
from app.services.embeddings.tag_descriptions import (
    EMBEDDING_ENABLED_TAGS,
    TAG_EMBEDDING_DESCRIPTIONS,
)
from app.services.tagging.tag_candidates import TagCandidate


MIN_EMBEDDING_CONFIDENCE = 0.60
MAX_EMBEDDING_CANDIDATES = 5


def encode_texts(texts: list[str]):
    from app.services.embeddings.embedding_service import encode_texts as service_encode_texts

    return service_encode_texts(texts)


def build_track_embedding_text(track: TrackEmbeddingInput) -> str:
    parts: list[str] = []

    if track.title:
        parts.append(f"Title: {track.title}")
    if track.artist:
        parts.append(f"Artist: {track.artist}")
    if track.album:
        parts.append(f"Album: {track.album}")

    filename = track.filename or track.file_name

    if filename:
        parts.append(f"Filename: {filename}")
    if track.folder_path:
        parts.append(f"Folder path: {track.folder_path}")
    if track.existing_tags:
        parts.append(f"Existing tags: {', '.join(track.existing_tags)}")
    if track.bpm is not None:
        parts.append(f"BPM: {track.bpm}")
    if track.energy_label:
        parts.append(f"Energy: {track.energy_label}")
    if track.loudness is not None:
        parts.append(f"Loudness: {track.loudness}")

    return ". ".join(parts)


def _similarity_to_confidence(similarity: float) -> float:
    """
    all-MiniLM cosine similarities are not guaranteed to map cleanly to confidence.
    This is a simple first-pass mapping that should be tuned with real library tests.
    """
    return max(0.0, min(1.0, similarity))


def generate_embedding_tag_candidates(
    track: TrackEmbeddingInput,
    *,
    min_confidence: float = MIN_EMBEDDING_CONFIDENCE,
    max_candidates: int = MAX_EMBEDDING_CANDIDATES,
) -> list[TagCandidate]:
    track_text = build_track_embedding_text(track)

    if not track_text.strip():
        return []

    tag_names = [
        tag_name
        for tag_name in TAG_EMBEDDING_DESCRIPTIONS
        if tag_name in EMBEDDING_ENABLED_TAGS
    ]
    tag_texts = [TAG_EMBEDDING_DESCRIPTIONS[name] for name in tag_names]

    if not tag_texts:
        return []

    embeddings = encode_texts([track_text, *tag_texts])

    track_embedding = embeddings[0]
    tag_embeddings = embeddings[1:]

    similarities = tag_embeddings @ track_embedding

    ranked_indices = np.argsort(similarities)[::-1]

    candidates: list[TagCandidate] = []

    for index in ranked_indices[:max_candidates]:
        tag_name = tag_names[index]
        similarity = float(similarities[index])
        confidence = _similarity_to_confidence(similarity)

        if confidence < min_confidence:
            continue

        candidates.append(
            TagCandidate(
                tag_name=tag_name,
                confidence=confidence,
                source="embedding",
                reason=f"Track metadata is semantically close to the '{tag_name}' tag description.",
            )
        )

    return candidates
