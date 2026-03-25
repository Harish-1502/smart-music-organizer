from app.services.art import detect_album_art

def test_detect_album_art_finds_cover_jpg(tmp_path):
    song = tmp_path / "track.mp3"
    cover = tmp_path / "cover.jpg"

    song.write_text("fake mp3")
    cover.write_text("fake image")

    result = detect_album_art(song)

    assert result == str(cover)


def test_detect_album_art_finds_folder_jpg(tmp_path):
    song = tmp_path / "track.mp3"
    folder_art = tmp_path / "folder.jpg"

    song.write_text("fake mp3")
    folder_art.write_text("fake image")

    result = detect_album_art(song)

    assert result == str(folder_art)


def test_detect_album_art_returns_none_when_missing(tmp_path):
    song = tmp_path / "track.mp3"
    song.write_text("fake mp3")

    result = detect_album_art(song)

    assert result is None