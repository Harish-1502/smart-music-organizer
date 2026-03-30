import re
import unicodedata

def normalize_text(value: str | None) -> str | None:
    if not value:
        return None

    value = unicodedata.normalize("NFKC", value)
    value = value.strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value

def apply_normalized_fields(track) -> None:
    track.title_normalized = normalize_text(track.display_title)
    track.artist_normalized = normalize_text(track.display_artist)
    track.album_normalized = normalize_text(track.display_album)