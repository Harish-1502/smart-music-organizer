from types import SimpleNamespace

from app.services.embeddings.track_embedding_cache import (
    TrackEmbeddingRequestCache,
    build_reference_embedding_text,
    track_to_embedding_input,
)


def make_track(track_id, title):
    return SimpleNamespace(
        id=track_id,
        display_title=title,
        title=None,
        scanned_title=None,
        display_artist="Artist",
        artist=None,
        scanned_artist=None,
        display_album=None,
        album=None,
        scanned_album=None,
        file_name=f"{title}.mp3",
        folder_path="S:/Music",
        bpm=None,
        energy_label=None,
        energy_score=None,
        loudness_db=None,
        loudness=None,
        track_tags=[],
    )


def make_track_tag(name):
    return SimpleNamespace(tag=SimpleNamespace(name=name))


def test_preload_encodes_missing_tracks_in_one_batch():
    calls = []

    def fake_encoder(texts):
        calls.append(list(texts))
        return [[float(index)] for index, _text in enumerate(texts)]

    first = make_track(1, "First")
    second = make_track(2, "Second")
    cache = TrackEmbeddingRequestCache(encoder=fake_encoder)

    cache.preload([first, second])

    assert len(calls) == 1
    assert len(calls[0]) == 2
    assert cache.get(first) == [0.0]
    assert cache.get(second) == [1.0]


def test_repeated_preload_for_same_track_uses_cache():
    calls = []

    def fake_encoder(texts):
        calls.append(list(texts))
        return [[1.0] for _text in texts]

    track = make_track(1, "Cached")
    cache = TrackEmbeddingRequestCache(encoder=fake_encoder)

    cache.preload([track])
    cache.preload([track])

    assert len(calls) == 1
    assert cache.get(track) == [1.0]


def test_reference_embedding_text_excludes_audio_descriptors():
    track = make_track(1, "Fast Loud Song")
    track.bpm = 128
    track.energy_label = "high_energy"
    track.energy_score = 0.95
    track.loudness_db = -7.5

    text = build_reference_embedding_text(track)

    assert "Title: Fast Loud Song" in text
    assert "Filename: Fast Loud Song.mp3" in text
    assert "BPM" not in text
    assert "128" not in text
    assert "Energy" not in text
    assert "high_energy" not in text
    assert "Loudness" not in text
    assert "-7.5" not in text
    assert "energy_score" not in text


def test_reference_embedding_text_excludes_target_and_subjective_tags():
    track = make_track(1, "Tagged Song")
    track.track_tags = [
        make_track_tag("workout"),
        make_track_tag("study"),
        make_track_tag("rap"),
        make_track_tag("remix"),
    ]

    text = build_reference_embedding_text(track, exclude_tag_name="rap")

    assert "workout" not in text
    assert "study" not in text
    assert "rap" not in text
    assert "remix" in text


def test_track_to_embedding_input_keeps_audio_descriptors_when_requested():
    track = make_track(1, "Audio Song")
    track.bpm = 100
    track.energy_label = "balanced"
    track.loudness_db = -12.0

    embedding_input = track_to_embedding_input(
        track,
        include_audio_descriptors=True,
    )

    assert embedding_input.bpm == 100.0
    assert embedding_input.energy_label == "balanced"
    assert embedding_input.loudness == -12.0
