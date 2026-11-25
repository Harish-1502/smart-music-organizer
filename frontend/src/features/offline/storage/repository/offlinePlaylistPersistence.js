import {
  normalizeOfflineId,
  normalizeTimestamp,
  normalizeNullableText,
  normalizePositiveInteger,
} from "./offlineMetadataUtils";
import {
  isSafeMobileLocalUri,
  normalizeOfflineTrackMetadata,
  sanitizeOfflinePlaylistMetadata,
  sanitizeOfflinePlaylistRow,
} from "./offlineMetadata";
import {
  shouldUseMobileOfflineSqlite,
  withMobileOfflineTransaction,
} from "./offlineDbHelpers";
import { bestEffortDeleteNativeTrackFiles } from "./offlineCleanup";

// Save a completed native playlist download and its ordered track membership.
export async function saveNativeDownloadedPlaylist(downloadPayload) {
  // Normalize the playlist ID and return null when it is missing or storage is not native Android.
  const normalizedPlaylistId = normalizeOfflineId(downloadPayload?.id);

  if (!normalizedPlaylistId || !shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Normalize downloaded tracks and retain valid IDs with safe app-local audio references.
  const downloadedAt = normalizeTimestamp(downloadPayload?.downloadedAt);
  const requestedTracks = Array.isArray(downloadPayload?.tracks)
    ? downloadPayload.tracks
    : [];
  const safeTracks = requestedTracks
    .map((track) => normalizeOfflineTrackMetadata(track, downloadedAt))
    .map((track, index) => ({
      ...track,
      audioLocalUri: normalizeNullableText(
        track?.audioLocalUri ?? requestedTracks[index]?.audioLocalUri,
      ),
      artworkLocalUri: normalizeNullableText(
        track?.artworkLocalUri ?? requestedTracks[index]?.artworkLocalUri,
      ),
      sizeBytes: normalizePositiveInteger(requestedTracks[index]?.sizeBytes),
    }))
    .filter((track) => track.id && isSafeMobileLocalUri(track.audioLocalUri));

  // Return null when no valid downloaded tracks remain.
  if (safeTracks.length === 0) {
    return null;
  }

  // Calculate total audio bytes and prepare the downloaded playlist metadata.
  const totalBytes = safeTracks.reduce(
    (sum, track) => sum + normalizePositiveInteger(track.sizeBytes),
    0,
  );
  const safePlaylist = sanitizeOfflinePlaylistMetadata(
    {
      id: normalizedPlaylistId,
      name: downloadPayload?.name,
      totalTracks: safeTracks.length,
      totalBytes,
      downloadStatus: "downloaded",
      storageType: "native_file",
      downloadedAt,
    },
    downloadedAt,
  );

  // Save metadata and relationships in one transaction so failed writes roll back together.
  const transactionResult = await withMobileOfflineTransaction(
    async (database) => {
      // Read the previous track IDs before replacing playlist membership.
      const previousTrackRows = await database.query(
        "SELECT track_id AS trackId FROM offline_playlist_tracks WHERE playlist_id = ?",
        [normalizedPlaylistId],
      );
      const previousTrackIds = Array.isArray(previousTrackRows?.values)
        ? previousTrackRows.values
            .map((row) => normalizeOfflineId(row?.trackId))
            .filter((trackId) => trackId !== null)
        : [];

      // Insert or update the downloaded playlist metadata.
      await database.run(
        `INSERT INTO offline_playlists (
          id,
          name,
          total_tracks,
          total_bytes,
          download_status,
          storage_type,
          downloaded_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          total_tracks = excluded.total_tracks,
          total_bytes = excluded.total_bytes,
          download_status = excluded.download_status,
          storage_type = excluded.storage_type,
          downloaded_at = excluded.downloaded_at,
          updated_at = excluded.updated_at`,
        [
          safePlaylist.id,
          safePlaylist.name,
          safePlaylist.totalTracks,
          safePlaylist.totalBytes,
          safePlaylist.downloadStatus,
          safePlaylist.storageType,
          safePlaylist.downloadedAt,
          safePlaylist.updatedAt,
        ],
        false,
      );

      // Remove previous relationships before saving the replacement track order.
      await database.run(
        "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
        [normalizedPlaylistId],
        false,
      );

      const savedTrackIds = [];

      // Insert or update each track and its required audio reference.
      for (let index = 0; index < safeTracks.length; index += 1) {
        const track = safeTracks[index];

        await database.run(
          `INSERT INTO offline_tracks (
            id,
            title,
            artist,
            album,
            duration,
            download_status,
            storage_type,
            downloaded_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            artist = excluded.artist,
            album = excluded.album,
            duration = excluded.duration,
            download_status = excluded.download_status,
            storage_type = excluded.storage_type,
            downloaded_at = COALESCE(excluded.downloaded_at, offline_tracks.downloaded_at),
            updated_at = excluded.updated_at`,
          [
            track.id,
            track.title,
            track.artist,
            track.album,
            track.duration,
            "downloaded",
            "native_file",
            track.downloadedAt,
            track.updatedAt,
          ],
          false,
        );

        await database.run(
          `INSERT INTO offline_media_files (
            track_id,
            media_type,
            local_uri,
            storage_type,
            downloaded_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(track_id, media_type) DO UPDATE SET
            local_uri = excluded.local_uri,
            storage_type = excluded.storage_type,
            downloaded_at = excluded.downloaded_at`,
          [
            track.id,
            "audio",
            track.audioLocalUri,
            "native_file",
            track.downloadedAt,
          ],
          false,
        );

        // Artwork is optional; save its reference only when it is safe.
        if (isSafeMobileLocalUri(track.artworkLocalUri)) {
          await database.run(
            `INSERT INTO offline_media_files (
              track_id,
              media_type,
              local_uri,
              storage_type,
              downloaded_at
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(track_id, media_type) DO UPDATE SET
              local_uri = excluded.local_uri,
              storage_type = excluded.storage_type,
              downloaded_at = excluded.downloaded_at`,
            [
              track.id,
              "artwork",
              track.artworkLocalUri,
              "native_file",
              track.downloadedAt,
            ],
            false,
          );
        }

        // Use the array index as the saved playlist track order.
        await database.run(
          `INSERT INTO offline_playlist_tracks (
            playlist_id,
            track_id,
            track_order,
            downloaded_at
          ) VALUES (?, ?, ?, ?)`,
          [normalizedPlaylistId, track.id, index, downloadedAt],
          false,
        );

        savedTrackIds.push(track.id);
      }

      // Find previous tracks that are absent from the replacement playlist.
      const retainedTrackIds = new Set(savedTrackIds);
      const removedExclusiveTrackIds = [];

      for (const previousTrackId of previousTrackIds) {
        if (retainedTrackIds.has(previousTrackId)) {
          continue;
        }

        const remainingPlaylistRows = await database.query(
          "SELECT COUNT(*) AS count FROM offline_playlist_tracks WHERE track_id = ?",
          [previousTrackId],
        );
        const remainingCount = normalizePositiveInteger(
          remainingPlaylistRows?.values?.[0]?.count,
        );

        // Preserve removed tracks that still belong to another downloaded playlist.
        if (remainingCount > 0) {
          continue;
        }

        // Remove metadata and media references for tracks with no remaining playlist relationships.
        await database.run(
          "DELETE FROM offline_media_files WHERE track_id = ?",
          [previousTrackId],
          false,
        );
        await database.run(
          "DELETE FROM offline_tracks WHERE id = ?",
          [previousTrackId],
          false,
        );
        removedExclusiveTrackIds.push(previousTrackId);
      }

      // Read back the saved playlist and collect track IDs requiring file cleanup.
      const playlistRows = await database.query(
        "SELECT * FROM offline_playlists WHERE id = ? LIMIT 1",
        [normalizedPlaylistId],
      );

      return {
        playlist: sanitizeOfflinePlaylistRow(playlistRows?.values?.[0] ?? null),
        removedExclusiveTrackIds,
      };
    },
  );

  // Return null if the transaction did not produce a saved playlist.
  if (!transactionResult?.playlist) {
    return null;
  }

  // Delete removed track files only after commit; individual deletion failures are tolerated.
  await bestEffortDeleteNativeTrackFiles(
    transactionResult.removedExclusiveTrackIds ?? [],
  );

  // Return the playlist after its database changes have committed and cleanup was attempted.
  return transactionResult.playlist;
}
