import { getDownloadedTracks } from "../storage/offlineStorage";
import { maskOfflineTrack } from "../../../utils/demoMode";
import {
  normalizeOfflineId,
  normalizeText,
  normalizeDownloadStatus,
  normalizeStorageType,
  normalizeNullableText,
} from "../storage/repository/offlineMetadataUtils";
import { isSafeMobileLocalUri } from "../storage/repository/offlineMetadata";
import {
  shouldUseMobileOfflineSqlite,
  queryRows,
} from "../storage/repository/offlineDbHelpers";

// Prepare a saved track for offline library browsing.
function buildSafeOfflineLibraryTrack(track) {
  // Normalize the track ID and return null when no valid ID is available.
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);

  if (!trackId) {
    return null;
  }

  // Keep safe app-local media references and discard unsafe or missing values.
  const audioLocalUri = isSafeMobileLocalUri(track?.audioLocalUri)
    ? normalizeNullableText(track.audioLocalUri)
    : null;
  const artworkLocalUri = isSafeMobileLocalUri(track?.artworkLocalUri)
    ? normalizeNullableText(track.artworkLocalUri)
    : null;
  // Derive a display filename from a local reference, falling back to the track ID.
  const fileNameSource = audioLocalUri ?? artworkLocalUri ?? "";
  const safeFileName = fileNameSource
    ? fileNameSource.split("/").pop() || fileNameSource
    : `offline-${trackId}`;

  // Build the library record with normalized metadata and storage references.
  // Playback URLs remain unresolved until playback requests them.
  return {
    id: trackId,
    track_id: trackId,
    title: normalizeText(track?.title, "Unknown Title"),
    artist: normalizeText(track?.artist),
    album: normalizeText(track?.album),
    duration: Number.isFinite(Number(track?.duration))
      ? Math.trunc(Number(track.duration))
      : null,
    downloadStatus: normalizeDownloadStatus(
      track?.downloadStatus,
      "downloaded",
    ),
    storageType: normalizeStorageType(
      track?.storageType,
      shouldUseMobileOfflineSqlite() ? "native_file" : "indexeddb_blob",
    ),
    downloadedAt: track?.downloadedAt ?? null,
    offline: true,
    file_name: safeFileName,
    audioSrc: null,
    artworkSrc: null,
    audioLocalUri,
    artworkLocalUri,
    audioBlobId: normalizeOfflineId(track?.audioBlobId),
    artworkBlobId: normalizeOfflineId(track?.artworkBlobId),
  };
}

// Read downloaded tracks and prepare them for the Library interface.
export async function getOfflineLibraryTracks() {
  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: getDownloadedTracks() reads the saved IndexedDB track records.
    const tracks = await getDownloadedTracks();

    // Format browser tracks, apply demo masking, and omit invalid results.
    return tracks
      .map((track) =>
        buildSafeOfflineLibraryTrack({
          ...track,
          storageType: "indexeddb_blob",
          downloadStatus: "downloaded",
        }),
      )
      .map(maskOfflineTrack)
      .filter(Boolean);
  }

  // Mobile path: read SQLite track metadata with audio and artwork references.
  // Rethrow query failures so unavailable storage is not shown as an empty library.
  const rows = await queryRows(
    `SELECT
        t.id,
        t.title,
        t.artist,
        t.album,
        t.duration,
        t.download_status AS downloadStatus,
        t.storage_type AS storageType,
        t.downloaded_at AS downloadedAt,
        audio.local_uri AS audioLocalUri,
        artwork.local_uri AS artworkLocalUri
      FROM offline_tracks t
      LEFT JOIN offline_media_files audio
        ON audio.track_id = t.id AND audio.media_type = 'audio'
      LEFT JOIN offline_media_files artwork
        ON artwork.track_id = t.id AND artwork.media_type = 'artwork'`,
    [],
    { rethrow: true },
  );

  // Format native tracks, apply demo masking, and omit invalid results.
  return rows.map(buildSafeOfflineLibraryTrack).map(maskOfflineTrack).filter(Boolean);
}
