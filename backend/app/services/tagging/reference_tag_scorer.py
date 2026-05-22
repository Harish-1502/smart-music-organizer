from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.embeddings.track_embedding_cache import (
    TrackEmbeddingRequestCache,
)
from app.services.tagging.reference_tag_suggestions import (
    GlobalReferenceTagSuggestion,
    MatchedReference,
    ReferenceTagSuggestion,
)
from app.services.tagging.reference_scoring_profiles import (
    ReferenceScoringProfile,
    get_reference_scoring_profile,
)


@dataclass(frozen=True)
class ReferenceTagScore:
    track_id: int
    tag_id: int
    positive_score: float
    negative_score: float
    final_score: float
    reasons: list[str] = field(default_factory=list)
    positive_matches: list[MatchedReference] = field(default_factory=list)
    negative_matches: list[MatchedReference] = field(default_factory=list)


def _clamp_score(value: float) -> float:
    return max(0.0, min(1.0, value))


def _numeric_value(track: Track, field_name: str) -> float | None:
    value = getattr(track, field_name, None)

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _feature_similarity(
    candidate_track: Track,
    reference_track: Track,
    field_name: str,
    scale: float,
) -> float | None:
    candidate_value = _numeric_value(candidate_track, field_name)
    reference_value = _numeric_value(reference_track, field_name)

    if candidate_value is None or reference_value is None:
        return None

    return _clamp_score(1.0 - (abs(candidate_value - reference_value) / scale))


def _track_audio_similarity(
    candidate_track: Track,
    reference_track: Track,
    profile: ReferenceScoringProfile,
) -> float:
    weighted_similarity_sum = 0.0
    used_weight_sum = 0.0

    for field_name, scale in profile.feature_scales.items():
        feature_weight = profile.feature_weights.get(field_name, 0.0)

        if feature_weight <= 0.0:
            continue

        similarity = _feature_similarity(
            candidate_track=candidate_track,
            reference_track=reference_track,
            field_name=field_name,
            scale=scale,
        )

        if similarity is not None:
            weighted_similarity_sum += similarity * feature_weight
            used_weight_sum += feature_weight

    if used_weight_sum <= 0.0:
        return 0.0

    return _clamp_score(weighted_similarity_sum / used_weight_sum)


def _track_title(track: Track) -> str | None:
    return (
        getattr(track, "display_title", None)
        or getattr(track, "title", None)
        or getattr(track, "scanned_title", None)
    )


def _track_artist(track: Track) -> str | None:
    return (
        getattr(track, "display_artist", None)
        or getattr(track, "artist", None)
        or getattr(track, "scanned_artist", None)
    )


def _matched_reference(
    reference: TagReferenceTrack,
    similarity: float,
) -> MatchedReference:
    track = reference.track

    return MatchedReference(
        track_id=reference.track_id,
        title=_track_title(track) if track else None,
        artist=_track_artist(track) if track else None,
        file_name=getattr(track, "file_name", None) if track else None,
        label=reference.label,
        similarity=round(_clamp_score(similarity), 3),
    )


def _encode_embedding_texts(texts: list[str]):
    from app.services.embeddings.embedding_service import encode_texts

    return encode_texts(texts)


def _dot_similarity(first_embedding, second_embedding) -> float:
    return _clamp_score(
        float(
            sum(
                float(first_value) * float(second_value)
                for first_value, second_value in zip(
                    first_embedding,
                    second_embedding,
                )
            )
        )
    )


def _embedding_reference_similarities_by_label(
    candidate_track: Track,
    references: list[TagReferenceTrack],
    embedding_cache: TrackEmbeddingRequestCache | None = None,
) -> dict[str, list[float]]:
    cache = embedding_cache or TrackEmbeddingRequestCache(
        encoder=_encode_embedding_texts,
    )

    reference_tracks = [
        reference.track
        for reference in references
        if reference.track_id != candidate_track.id and reference.track is not None
    ]
    cache.preload([candidate_track, *reference_tracks])

    candidate_embedding = cache.get(candidate_track)

    if candidate_embedding is None:
        return {"positive": [], "negative": []}

    similarities_by_label = {"positive": [], "negative": []}

    for reference in references:
        if reference.track_id == candidate_track.id:
            continue

        if reference.label not in similarities_by_label or reference.track is None:
            continue

        reference_embedding = cache.get(reference.track)

        if reference_embedding is None:
            continue

        similarities_by_label[reference.label].append(
            _dot_similarity(candidate_embedding, reference_embedding)
        )

    return similarities_by_label


def _top_k_matches(
    matches: list[MatchedReference],
    top_k: int,
) -> list[MatchedReference]:
    if not matches:
        return []

    usable_top_k = max(1, top_k)

    return sorted(matches, key=lambda match: match.similarity, reverse=True)[
        :usable_top_k
    ]


def _average_matches(matches: list[MatchedReference]) -> float:
    if not matches:
        return 0.0

    return _clamp_score(
        sum(match.similarity for match in matches) / len(matches)
    )


def _average_top_k(similarities: list[float], top_k: int) -> float:
    if not similarities:
        return 0.0

    usable_top_k = max(1, top_k)
    top_similarities = sorted(similarities, reverse=True)[:usable_top_k]

    return _clamp_score(sum(top_similarities) / len(top_similarities))


def _reference_matches(
    candidate_track: Track,
    references: list[TagReferenceTrack],
    label: str,
    profile: ReferenceScoringProfile,
) -> list[MatchedReference]:
    return [
        _matched_reference(
            reference,
            _track_audio_similarity(candidate_track, reference.track, profile),
        )
        for reference in references
        if reference.label == label and reference.track_id != candidate_track.id
    ]


def _format_reference_match(prefix: str, match: MatchedReference) -> str:
    title = match.title or match.file_name or f"Track {match.track_id}"
    artist = match.artist or "Unknown Artist"

    return (
        f'{prefix}: "{title}" by {artist}, '
        f"similarity {match.similarity:.2f}"
    )


def _score_explanation(final_score: float) -> str:
    if final_score >= 0.75:
        return "Final score is high because positive references strongly outweighed negative references"

    if final_score >= 0.5:
        return "Final score is moderate because positive references only partially outweighed negative references"

    return "Final score is low because positive reference similarity was weak or offset by negative references"


def score_track_against_tag_references(
    db: Session,
    track_id: int,
    tag_id: int,
    *,
    top_k: int | None = None,
    include_embeddings: bool = True,
    references: list[TagReferenceTrack] | None = None,
    embedding_cache: TrackEmbeddingRequestCache | None = None,
) -> ReferenceTagScore:
    candidate_track = db.get(Track, track_id)

    if not candidate_track:
        raise ValueError(f"Track does not exist: {track_id}")

    tag = db.get(Tag, tag_id)

    if not tag:
        raise ValueError(f"Tag does not exist: {tag_id}")

    if references is None:
        references = (
            db.query(TagReferenceTrack)
            .filter(TagReferenceTrack.tag_id == tag_id)
            .all()
        )

    profile = get_reference_scoring_profile(tag.name)
    effective_top_k = top_k if top_k is not None else profile.top_k

    positive_matches = _reference_matches(
        candidate_track=candidate_track,
        references=references,
        label="positive",
        profile=profile,
    )
    negative_matches = _reference_matches(
        candidate_track=candidate_track,
        references=references,
        label="negative",
        profile=profile,
    )
    positive_top_matches = _top_k_matches(positive_matches, effective_top_k)
    negative_top_matches = _top_k_matches(negative_matches, effective_top_k)

    positive_score = _average_matches(positive_top_matches)
    negative_score = _average_matches(negative_top_matches)
    embedding_positive_score = 0.0
    embedding_negative_score = 0.0
    embeddings_contributed = False
    reasons = []

    if include_embeddings:
        try:
            embedding_similarities = _embedding_reference_similarities_by_label(
                candidate_track=candidate_track,
                references=references,
                embedding_cache=embedding_cache,
            )
            positive_embedding_similarities = embedding_similarities["positive"]
            negative_embedding_similarities = embedding_similarities["negative"]

            if positive_embedding_similarities or negative_embedding_similarities:
                embeddings_contributed = True
                embedding_positive_score = _average_top_k(
                    positive_embedding_similarities,
                    effective_top_k,
                )
                embedding_negative_score = _average_top_k(
                    negative_embedding_similarities,
                    effective_top_k,
                )
                positive_score = _clamp_score(
                    (profile.audio_weight * positive_score)
                    + (profile.embedding_weight * embedding_positive_score)
                )
                negative_score = _clamp_score(
                    (profile.audio_weight * negative_score)
                    + (profile.embedding_weight * embedding_negative_score)
                )
        except Exception:
            reasons.append("Embedding similarity unavailable; used audio-only scoring")

    if not positive_matches:
        reasons.append("No positive references found")
        final_score = 0.0
    else:
        reasons.append(f"Using {tag.name} scoring profile")
        reasons.append(f"Suggested tag: {tag.name}")
        reasons.append(
            f"Compared against {len(positive_matches)} positive references"
        )
        reasons.append(
            _format_reference_match(
                "Closest positive reference",
                positive_top_matches[0],
            )
        )
        final_score = positive_score - (profile.negative_weight * negative_score)
        reasons.append(_score_explanation(_clamp_score(final_score)))

    if negative_matches:
        reasons.append(
            f"Compared against {len(negative_matches)} negative references"
        )
        reasons.append(
            _format_reference_match(
                "Closest negative reference",
                negative_top_matches[0],
            )
        )
    else:
        reasons.append("No negative references found")

    if embeddings_contributed:
        reasons.append(
            f"Embedding positive similarity contributed: {embedding_positive_score:.2f}"
        )
        reasons.append(
            f"Embedding negative similarity contributed: {embedding_negative_score:.2f}"
        )

    return ReferenceTagScore(
        track_id=track_id,
        tag_id=tag_id,
        positive_score=round(_clamp_score(positive_score), 3),
        negative_score=round(_clamp_score(negative_score), 3),
        final_score=round(_clamp_score(final_score), 3),
        reasons=reasons,
        positive_matches=positive_top_matches,
        negative_matches=negative_top_matches,
    )


def suggest_tracks_for_tag_from_references(
    db: Session,
    tag_id: int,
    *,
    limit: int = 25,
    min_score: float = 0.65,
    include_embeddings: bool = True,
) -> list[ReferenceTagSuggestion]:
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise ValueError(f"Tag does not exist: {tag_id}")

    references = (
        db.query(TagReferenceTrack)
        .filter(TagReferenceTrack.tag_id == tag_id)
        .all()
    )
    positive_count = sum(
        1 for reference in references if reference.label == "positive"
    )

    if positive_count == 0:
        return []

    already_tagged_track_ids = {
        row.track_id
        for row in db.query(TrackTag.track_id)
        .filter(TrackTag.tag_id == tag_id)
        .all()
    }

    reference_track_ids = {reference.track_id for reference in references}

    excluded_track_ids = already_tagged_track_ids | reference_track_ids

    query = db.query(Track)

    if excluded_track_ids:
        query = query.filter(~Track.id.in_(excluded_track_ids))

    tracks = query.all()
    embedding_cache = None
    use_embeddings_for_scores = include_embeddings

    if include_embeddings:
        embedding_cache = TrackEmbeddingRequestCache(encoder=_encode_embedding_texts)

        try:
            reference_tracks = [
                reference.track
                for reference in references
                if reference.track is not None
            ]
            embedding_cache.preload([*tracks, *reference_tracks])
        except Exception:
            embedding_cache = None
            use_embeddings_for_scores = False

    suggestions: list[ReferenceTagSuggestion] = []

    for track in tracks:
        score = score_track_against_tag_references(
            db,
            track_id=track.id,
            tag_id=tag_id,
            include_embeddings=use_embeddings_for_scores,
            references=references,
            embedding_cache=embedding_cache,
        )

        if score.final_score < min_score:
            continue

        suggestions.append(
            ReferenceTagSuggestion(
                track_id=track.id,
                tag_id=tag_id,
                title=getattr(track, "display_title", None)
                or getattr(track, "title", None)
                or getattr(track, "scanned_title", None),
                artist=getattr(track, "display_artist", None)
                or getattr(track, "artist", None)
                or getattr(track, "scanned_artist", None),
                file_name=getattr(track, "file_name", None),
                final_score=score.final_score,
                positive_score=score.positive_score,
                negative_score=score.negative_score,
                reasons=score.reasons,
                positive_matches=score.positive_matches,
                negative_matches=score.negative_matches,
            )
        )

    suggestions.sort(key=lambda item: item.final_score, reverse=True)

    return suggestions[:limit]


def suggest_tracks_for_all_reference_tags(
    db: Session,
    *,
    limit: int = 50,
    min_score: float = 0.65,
    include_embeddings: bool = True,
) -> list[GlobalReferenceTagSuggestion]:
    eligible_tags = (
        db.query(Tag)
        .join(TagReferenceTrack, TagReferenceTrack.tag_id == Tag.id)
        .filter(TagReferenceTrack.label == "positive")
        .distinct()
        .all()
    )

    suggestions: list[GlobalReferenceTagSuggestion] = []

    for tag in eligible_tags:
        tag_suggestions = suggest_tracks_for_tag_from_references(
            db,
            tag.id,
            limit=limit,
            min_score=min_score,
            include_embeddings=include_embeddings,
        )

        suggestions.extend(
            GlobalReferenceTagSuggestion(
                track_id=suggestion.track_id,
                tag_id=suggestion.tag_id,
                tag_name=tag.name,
                title=suggestion.title,
                artist=suggestion.artist,
                file_name=suggestion.file_name,
                final_score=suggestion.final_score,
                positive_score=suggestion.positive_score,
                negative_score=suggestion.negative_score,
                reasons=suggestion.reasons,
                positive_matches=suggestion.positive_matches,
                negative_matches=suggestion.negative_matches,
            )
            for suggestion in tag_suggestions
        )

    suggestions.sort(key=lambda item: item.final_score, reverse=True)

    return suggestions[:limit]
