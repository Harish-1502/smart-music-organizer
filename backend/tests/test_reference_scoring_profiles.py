from app.services.tagging.reference_scoring_profiles import (
    DEFAULT_REFERENCE_SCORING_PROFILE,
    get_reference_scoring_profile,
)


def test_get_reference_scoring_profile_returns_default_for_unknown_tag():
    assert (
        get_reference_scoring_profile("made_up_tag")
        == DEFAULT_REFERENCE_SCORING_PROFILE
    )


def test_get_reference_scoring_profile_returns_workout_profile():
    profile = get_reference_scoring_profile("WORKOUT")

    assert profile.audio_weight == 0.45
    assert profile.embedding_weight == 0.55
    assert profile.negative_weight == 0.75


def test_high_energy_profile_weights_energy_more_than_duration():
    profile = get_reference_scoring_profile("high_energy")

    assert profile.feature_weights["energy_score"] > profile.feature_weights["duration"]
    assert "loudness_db" in profile.feature_weights
