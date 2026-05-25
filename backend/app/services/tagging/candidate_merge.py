from app.services.tagging.tag_candidates import TagCandidate


def merge_tag_candidates(candidates: list[TagCandidate]) -> list[TagCandidate]:
    """
    Merge duplicate tag candidates, keeping the highest-confidence candidate.
    """
    merged: dict[str, TagCandidate] = {}

    for candidate in candidates:
        current_candidate = merged.get(candidate.tag_name)

        if (
            current_candidate is None
            or candidate.confidence > current_candidate.confidence
        ):
            merged[candidate.tag_name] = candidate

    return list(merged.values())
