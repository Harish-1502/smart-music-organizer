from dataclasses import dataclass


AUTO_APPLY_THRESHOLD = 0.70


@dataclass(frozen=True)
class TagCandidate:
    tag_name: str
    confidence: float
    source: str = "rule"

    def __iter__(self):
        yield self.tag_name
        yield self.confidence

    def as_tuple(self) -> tuple[str, float]:
        return self.tag_name, self.confidence
