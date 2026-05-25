from dataclasses import dataclass


DEFAULT_FEATURE_SCALES = {
    "bpm": 40.0,
    "energy_score": 1.0,
    "loudness_db": 30.0,
    "duration": 180.0,
}


@dataclass(frozen=True)
class ReferenceScoringProfile:
    audio_weight: float
    embedding_weight: float
    negative_weight: float
    conflict_ranking_weight: float
    top_k: int
    feature_scales: dict[str, float]
    feature_weights: dict[str, float]


DEFAULT_REFERENCE_SCORING_PROFILE = ReferenceScoringProfile(
    audio_weight=0.60,
    embedding_weight=0.40,
    negative_weight=0.60,
    conflict_ranking_weight=0.25,
    top_k=2,
    feature_scales=DEFAULT_FEATURE_SCALES,
    feature_weights={
        "bpm": 0.25,
        "energy_score": 0.35,
        "loudness_db": 0.25,
        "duration": 0.15,
    },
)


REFERENCE_SCORING_PROFILES = {
    "workout": ReferenceScoringProfile(
        audio_weight=0.45,
        embedding_weight=0.55,
        negative_weight=0.75,
        conflict_ranking_weight=0.30,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.15,
            "energy_score": 0.45,
            "loudness_db": 0.25,
            "duration": 0.15,
        },
    ),
    "study": ReferenceScoringProfile(
        audio_weight=0.75,
        embedding_weight=0.25,
        negative_weight=0.80,
        conflict_ranking_weight=0.30,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.10,
            "energy_score": 0.45,
            "loudness_db": 0.35,
            "duration": 0.10,
        },
    ),
    "chill": ReferenceScoringProfile(
        audio_weight=0.70,
        embedding_weight=0.30,
        negative_weight=0.75,
        conflict_ranking_weight=0.30,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.15,
            "energy_score": 0.45,
            "loudness_db": 0.30,
            "duration": 0.10,
        },
    ),
    "driving": ReferenceScoringProfile(
        audio_weight=0.50,
        embedding_weight=0.50,
        negative_weight=0.65,
        conflict_ranking_weight=0.25,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.25,
            "energy_score": 0.35,
            "loudness_db": 0.20,
            "duration": 0.20,
        },
    ),
    "high_energy": ReferenceScoringProfile(
        audio_weight=0.90,
        embedding_weight=0.10,
        negative_weight=0.50,
        conflict_ranking_weight=0.15,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.25,
            "energy_score": 0.55,
            "loudness_db": 0.20,
            "duration": 0.00,
        },
    ),
    "low_energy": ReferenceScoringProfile(
        audio_weight=0.90,
        embedding_weight=0.10,
        negative_weight=0.60,
        conflict_ranking_weight=0.20,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.15,
            "energy_score": 0.55,
            "loudness_db": 0.25,
            "duration": 0.05,
        },
    ),
    "party": ReferenceScoringProfile(
        audio_weight=0.55,
        embedding_weight=0.45,
        negative_weight=0.65,
        conflict_ranking_weight=0.30,
        top_k=2,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights={
            "bpm": 0.25,
            "energy_score": 0.40,
            "loudness_db": 0.25,
            "duration": 0.10,
        },
    ),
}


def get_reference_scoring_profile(tag_name: str) -> ReferenceScoringProfile:
    normalized_name = (tag_name or "").strip().lower()
    return REFERENCE_SCORING_PROFILES.get(
        normalized_name,
        DEFAULT_REFERENCE_SCORING_PROFILE,
    )
