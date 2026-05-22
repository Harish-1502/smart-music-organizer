from types import SimpleNamespace

from app.services.embeddings.track_embedding_cache import (
    TrackEmbeddingRequestCache,
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
        loudness=None,
        track_tags=[],
    )


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
