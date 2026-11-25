import pytest

from app.services.prompt_parser import (
    DEFAULT_DURATION_MINUTES,
    MAX_DURATION_MINUTES,
    MIN_DURATION_MINUTES,
    detect_duration,
    normalize_prompt,
    parse_prompt,
)


def test_normalize_prompt_lowercases_removes_punctuation_and_tokenizes():
    normalized, tokens = normalize_prompt(
        "  Make me a Chill, Study playlist under 45 minutes!  "
    )

    assert normalized == "make me a chill study playlist under 45 minutes"
    assert tokens == {
        "make",
        "me",
        "a",
        "chill",
        "study",
        "playlist",
        "under",
        "45",
        "minutes",
    }


def test_normalize_prompt_rejects_empty_prompt():
    with pytest.raises(ValueError):
        normalize_prompt("   ")


def test_normalize_prompt_rejects_none_prompt():
    with pytest.raises(ValueError):
        normalize_prompt(None)


def test_detect_duration_under_30_minutes():
    assert detect_duration("workout playlist under 30 minutes") == 30


def test_detect_duration_less_than_45_minutes():
    assert detect_duration("chill playlist less than 45 minutes") == 45


def test_detect_duration_below_1_hour():
    assert detect_duration("gaming playlist below 1 hour") == 60


def test_detect_duration_30_min():
    assert detect_duration("make a 30 min playlist") == 30


def test_detect_duration_1_hour():
    assert detect_duration("make a 1 hour playlist") == 60


def test_detect_duration_defaults_when_missing():
    assert detect_duration("make me a chill playlist") == DEFAULT_DURATION_MINUTES


def test_detect_duration_clamps_too_low():
    assert detect_duration("make a 1 minute playlist") == MIN_DURATION_MINUTES


def test_detect_duration_clamps_too_high():
    assert detect_duration("make a 9999 minute playlist") == MAX_DURATION_MINUTES


def test_parse_chill_study_prompt():
    result = parse_prompt("Make me a chill study playlist under 45 minutes")

    assert result["duration_max_minutes"] == 45
    assert result["energy"] == "low"

    assert "study" in result["use_cases"]

    assert "chill" in result["moods"]
    assert "calm" in result["moods"]
    assert "focus" in result["moods"]

    assert result["genres"] == []
    assert result["exclude_moods"] == []
    assert result["exclude_keywords"] == []
    assert result["warnings"] == []


def test_parse_workout_prompt():
    result = parse_prompt("workout playlist under 30 minutes")

    assert result["duration_max_minutes"] == 30
    assert result["energy"] == "high"
    assert "workout" in result["use_cases"]
    assert "hype" in result["moods"]


def test_parse_gaming_prompt_below_1_hour():
    result = parse_prompt("gaming playlist below 1 hour")

    assert result["duration_max_minutes"] == 60
    assert result["energy"] == "high"
    assert "gaming" in result["use_cases"]
    assert "focus" in result["moods"]
    assert "hype" in result["moods"]


def test_parse_genre_prompt():
    result = parse_prompt("make me a hip hop and rap playlist under 30 minutes")

    assert result["duration_max_minutes"] == 30
    assert "hip hop" in result["genres"]
    assert "rap" in result["genres"]
    assert result["energy"] == "high"


def test_parse_rnb_phrase_after_normalization():
    result = parse_prompt("make me an R&B playlist")

    assert "r&b" in result["genres"]


def test_parse_exclusion_prompt():
    result = parse_prompt("make me a rap playlist with no sad songs under 45 minutes")

    assert result["duration_max_minutes"] == 45
    assert "rap" in result["genres"]
    assert "sad" in result["exclude_moods"]
    assert "sad" in result["exclude_keywords"]


def test_parse_vague_prompt_adds_warning():
    result = parse_prompt("make me a playlist")

    assert result["duration_max_minutes"] == DEFAULT_DURATION_MINUTES
    assert result["energy"] == "medium"
    assert result["use_cases"] == []
    assert result["moods"] == []
    assert result["genres"] == []
    assert result["warnings"] == [
        "Prompt was vague, so generation will use general metadata matching."
    ]


def test_empty_prompt_parse_raises_value_error():
    with pytest.raises(ValueError):
        parse_prompt("")