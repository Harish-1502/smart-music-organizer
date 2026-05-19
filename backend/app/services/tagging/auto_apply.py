from app.services.tagging.tag_candidates import (
    AUTO_APPLY_THRESHOLD,
    TagCandidate,
)


def get_auto_apply_candidates(
    candidates: list[TagCandidate],
    threshold: float = AUTO_APPLY_THRESHOLD,
) -> list[TagCandidate]:
    return [
        candidate
        for candidate in candidates
        if candidate.confidence >= threshold
    ]
