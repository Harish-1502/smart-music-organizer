from app.services.tag_inference import (
    infer_track_tags,
    normalize_text,
    keyword_matches,
)


class FakeTrack:
    def __init__(
        self,
        display_title=None,
        display_artist=None,
        display_album=None,
        title=None,
        artist=None,
        album=None,
        scanned_title=None,
        scanned_artist=None,
        scanned_album=None,
        file_name=None,
        folder_path=None,
        duration=None,
    ):
        self.display_title = display_title
        self.display_artist = display_artist
        self.display_album = display_album
        self.title = title
        self.artist = artist
        self.album = album
        self.scanned_title = scanned_title
        self.scanned_artist = scanned_artist
        self.scanned_album = scanned_album
        self.file_name = file_name
        self.folder_path = folder_path
        self.duration = duration


def tag_names(result):
    return {tag_name for tag_name, confidence in result}


def test_normalize_text_handles_file_style_names():
    result = normalize_text("Late-Night_Vibes!!!.mp3")

    assert result == "late night vibes mp3"


def test_keyword_matches_single_word_without_matching_inside_other_words():
    text = normalize_text("scrap metal sounds")

    assert keyword_matches(text, "scrap") is True
    assert keyword_matches(text, "rap") is False


def test_keyword_matches_multi_word_phrase():
    text = normalize_text("perfect late night drive playlist")

    assert keyword_matches(text, "late night") is True
    assert keyword_matches(text, "deep work") is False


def test_infers_lofi_study_tags():
    track = FakeTrack(
        display_title="lofi study beats",
        file_name="lofi_chill_study_beats.mp3",
        folder_path="S:/Music/Study/Lofi",
        duration=180,
    )

    result = infer_track_tags(track)
    names = tag_names(result)

    assert "lofi" in names
    assert "chill" in names
    assert "study" in names


def test_infers_workout_tags():
    track = FakeTrack(
        display_title="gym pump anthem",
        file_name="workout_banger.mp3",
        folder_path="S:/Music/Gym",
        duration=210,
    )

    result = infer_track_tags(track)
    names = tag_names(result)

    assert "workout" in names


def test_infers_sad_night_driving_tags():
    track = FakeTrack(
        display_title="sad late night drive",
        file_name="sad_night_drive.mp3",
        folder_path="S:/Music/Night Drive",
        duration=240,
    )

    result = infer_track_tags(track)
    names = tag_names(result)

    assert "sad" in names
    assert "night" in names
    assert "driving" in names


def test_infers_short_track_from_duration():
    track = FakeTrack(
        display_title="album intro",
        file_name="intro.mp3",
        duration=60,
    )

    result = infer_track_tags(track)
    names = tag_names(result)

    assert "short" in names


def test_infers_long_track_from_duration():
    track = FakeTrack(
        display_title="extended ambient mix",
        file_name="extended_ambient_mix.mp3",
        duration=500,
    )

    result = infer_track_tags(track)
    names = tag_names(result)

    assert "long" in names


def test_does_not_infer_rap_from_scrap():
    track = FakeTrack(
        display_title="scrap metal sounds",
        file_name="scrap_song.mp3",
        duration=200,
    )

    result = infer_track_tags(track)
    names = tag_names(result)

    assert "rap" not in names


def test_keeps_highest_confidence_when_duplicate_tag_is_inferred():
    track = FakeTrack(
        display_title="lofi chill study beats",
        file_name="lofi_chill_study_beats.mp3",
        folder_path="S:/Music/lofi",
        duration=180,
    )

    result = infer_track_tags(track)

    tag_counts = {}

    for tag_name, confidence in result:
        tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1

    assert all(count == 1 for count in tag_counts.values())