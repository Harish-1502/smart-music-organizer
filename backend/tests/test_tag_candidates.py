from dataclasses import FrozenInstanceError

import pytest

from app.services.tagging.auto_apply import get_auto_apply_candidates
from app.services.tagging.candidate_merge import merge_tag_candidates
from app.services.tagging.tag_candidates import (
    AUTO_APPLY_THRESHOLD,
    TagCandidate,
)


def test_tag_candidate_creation_is_frozen_and_tuple_compatible():
    candidate = TagCandidate(
        tag_name="chill",
        confidence=0.75,
        source="rule",
    )

    assert AUTO_APPLY_THRESHOLD > 0
    assert candidate.tag_name == "chill"
    assert candidate.confidence == 0.75
    assert candidate.source == "rule"
    assert tuple(candidate) == ("chill", 0.75)
    assert candidate.as_tuple() == ("chill", 0.75)

    with pytest.raises(FrozenInstanceError):
        candidate.confidence = 0.5


def test_merge_tag_candidates_keeps_highest_confidence_duplicate():
    candidates = [
        TagCandidate(tag_name="chill", confidence=0.60),
        TagCandidate(tag_name="chill", confidence=0.85),
        TagCandidate(tag_name="lofi", confidence=0.80),
    ]

    result = merge_tag_candidates(candidates)

    assert result == [
        TagCandidate(tag_name="chill", confidence=0.85),
        TagCandidate(tag_name="lofi", confidence=0.80),
    ]


def test_get_auto_apply_candidates_only_returns_candidates_at_or_above_threshold():
    candidates = [
        TagCandidate(tag_name="low", confidence=AUTO_APPLY_THRESHOLD - 0.01),
        TagCandidate(tag_name="exact", confidence=AUTO_APPLY_THRESHOLD),
        TagCandidate(tag_name="high", confidence=AUTO_APPLY_THRESHOLD + 0.01),
    ]

    result = get_auto_apply_candidates(
        candidates,
        threshold=AUTO_APPLY_THRESHOLD,
    )

    assert [candidate.tag_name for candidate in result] == ["exact", "high"]
