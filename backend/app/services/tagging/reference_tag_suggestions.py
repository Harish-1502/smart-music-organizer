from dataclasses import dataclass


@dataclass(frozen=True)
class MatchedReference:
    track_id: int
    title: str | None
    artist: str | None
    file_name: str | None
    label: str
    similarity: float
    audio_similarity: float | None = None
    embedding_similarity: float | None = None


@dataclass(frozen=True)
class ReferenceTagSuggestion:
    track_id: int
    tag_id: int
    title: str | None
    artist: str | None
    file_name: str | None
    match_score: float
    conflict_score: float
    ranking_score: float
    status: str
    final_score: float
    positive_score: float
    negative_score: float
    reasons: list[str]
    positive_matches: list[MatchedReference]
    negative_matches: list[MatchedReference]


@dataclass(frozen=True)
class GlobalReferenceTagSuggestion:
    track_id: int
    tag_id: int
    tag_name: str
    title: str | None
    artist: str | None
    file_name: str | None
    match_score: float
    conflict_score: float
    ranking_score: float
    status: str
    final_score: float
    positive_score: float
    negative_score: float
    reasons: list[str]
    positive_matches: list[MatchedReference]
    negative_matches: list[MatchedReference]
