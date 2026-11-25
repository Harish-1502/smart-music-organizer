import {
  getNativeMediaFileSize,
  nativeMediaFileExists,
} from "../storage/nativeMediaFileStorage";
import { hiddenPathValue, isDemoMode } from "../../../utils/demoMode";
import {
  normalizeOfflineId,
  normalizePositiveInteger,
  normalizeNullableText,
} from "../storage/repository/offlineMetadataUtils";
import { shouldUseMobileOfflineSqlite } from "../storage/repository/offlineDbHelpers";
import {
  getOfflinePlaylists,
  getOfflineTracksForPlaylist,
} from "../storage/repository/offlinePlaylistRepository";

// Count tracks with a nonempty stored media reference without checking physical files.
function countTracksWithLocalUri(tracks, key) {
  return tracks.filter((track) => normalizeNullableText(track?.[key])).length;
}

// Inspect referenced files and collect details for the diagnostic report.
async function inspectTrackMediaFiles(tracks, key) {
  const details = [];

  for (const track of tracks) {
    // Read the selected audio or artwork reference and skip tracks without one.
    const relativePath = normalizeNullableText(track?.[key]);

    if (!relativePath) {
      continue;
    }

    // Check file existence, then read its size when the file is present.
    const exists = await nativeMediaFileExists(relativePath);
    const sizeBytes = exists
      ? await getNativeMediaFileSize(relativePath)
      : null;

    // Record the result and hide local paths when demo mode is enabled.
    details.push({
      trackId: normalizeOfflineId(track?.id),
      relativePath: isDemoMode() ? hiddenPathValue() : relativePath,
      exists,
      sizeBytes: normalizePositiveInteger(sizeBytes, 0),
    });
  }

  // Return details for referenced files, including files that could not be found.
  return details;
}

// Compare a native playlist's stored media references with the files on the device.
export async function inspectNativeMediaFilesForPlaylist(playlistId) {
  // Normalize the playlist ID; return null for missing IDs or non-native storage.
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId || !shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Read the playlist's tracks, then inspect their audio and artwork files.
  const tracks = await getOfflineTracksForPlaylist(normalizedPlaylistId);
  const audioFiles = await inspectTrackMediaFiles(tracks, "audioLocalUri");
  const artworkFiles = await inspectTrackMediaFiles(tracks, "artworkLocalUri");
  // Count stored references separately from files actually found on the device.
  const sqliteAudioMediaRefCount = countTracksWithLocalUri(
    tracks,
    "audioLocalUri",
  );
  const sqliteArtworkMediaRefCount = countTracksWithLocalUri(
    tracks,
    "artworkLocalUri",
  );

  // Return reference counts, per-file details, and existing and missing file counts.
  // Tracks without references are excluded from the per-file missing counts.
  return {
    playlistId: normalizedPlaylistId,
    trackCount: tracks.length,
    sqliteAudioMediaRefCount,
    sqliteArtworkMediaRefCount,
    nativeAudioFiles: audioFiles,
    nativeAudioFileCount: audioFiles.filter((file) => file.exists).length,
    missingNativeAudioFileCount: audioFiles.filter((file) => !file.exists)
      .length,
    nativeArtworkFiles: artworkFiles,
    nativeArtworkFileCount: artworkFiles.filter((file) => file.exists).length,
    missingNativeArtworkFileCount: artworkFiles.filter((file) => !file.exists)
      .length,
  };
}

// Assemble playlist metadata and native file inspection into one diagnostic report.
export async function inspectDownloadedPlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId || !shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Load saved playlists and inspect this playlist's files concurrently.
  const [playlists, trackInspection] = await Promise.all([
    getOfflinePlaylists(),
    inspectNativeMediaFilesForPlaylist(normalizedPlaylistId),
  ]);

  // Find the requested playlist and return null if metadata or inspection is unavailable.
  const playlist =
    playlists.find((entry) => entry.id === normalizedPlaylistId) ?? null;

  if (!playlist || !trackInspection) {
    return null;
  }

  // Combine saved playlist totals with the actual track, reference, and file counts.
  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    trackCount: normalizePositiveInteger(playlist.totalTracks),
    sqliteTrackRowCount: trackInspection.trackCount,
    sqliteAudioMediaRefCount: trackInspection.sqliteAudioMediaRefCount,
    sqliteArtworkMediaRefCount: trackInspection.sqliteArtworkMediaRefCount,
    nativeAudioFileCount: trackInspection.nativeAudioFileCount,
    missingNativeAudioFileCount: trackInspection.missingNativeAudioFileCount,
    nativeArtworkFileCount: trackInspection.nativeArtworkFileCount,
    missingNativeArtworkFileCount:
      trackInspection.missingNativeArtworkFileCount,
    audioFiles: trackInspection.nativeAudioFiles,
    artworkFiles: trackInspection.nativeArtworkFiles,
  };
}
