// Returns the first non-empty string from a list of possible track fields.
export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function getTrackDisplayTitle(track) {
  return (
    firstNonEmpty(
      track?.title,
      track?.display_title,
      track?.scanned_title,
      track?.file_name,
    ) || "Untitled track"
  );
}

export function getTrackDisplayArtist(track) {
  return (
    firstNonEmpty(
      track?.artist,
      track?.display_artist,
      track?.scanned_artist,
    ) || "Unknown artist"
  );
}

export function getTrackDisplayAlbum(track) {
  return (
    firstNonEmpty(track?.album, track?.display_album, track?.scanned_album) ||
    "Unknown album"
  );
}

export function getTrackDisplayFileName(track) {
  return firstNonEmpty(track?.file_name, getTrackDisplayTitle(track));
}
