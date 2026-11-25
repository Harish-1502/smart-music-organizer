import {
  getDownloadedPlaylist,
  getDownloadedPlaylists,
  getDownloadedTracks,
  hasDownloadedPlaylist as hasIndexedDbDownloadedPlaylist,
} from "../offlineStorage";
import { maskOfflineTrack, maskPlaylist } from "../../../../utils/demoMode";
import { normalizeOfflineId } from "./offlineMetadataUtils";
import {
  sanitizeOfflinePlaylistMetadata,
  sanitizeOfflineTrackRow,
  sanitizeOfflinePlaylistRow,
} from "./offlineMetadata";
import {
  shouldUseMobileOfflineSqlite,
  ensureMobileOfflineDbReady,
  queryRows,
  withMobileOfflineTransaction,
} from "./offlineDbHelpers";

// Check whether a playlist has a saved offline record.
export async function hasOfflinePlaylist(playlistId) {
  // Normalize the playlist ID and return false if it is missing.
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return false;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: check the downloaded playlists in IndexedDB.
    return hasIndexedDbDownloadedPlaylist(normalizedPlaylistId);
  }

  // Mobile path: look for the playlist metadata in SQLite.
  const rows = await queryRows(
    "SELECT id FROM offline_playlists WHERE id = ? LIMIT 1",
    [normalizedPlaylistId],
  );

  // A saved record confirms membership in offline storage, not file availability.
  return rows.length > 0;
}

// Read the saved playlists from browser storage or native SQLite.
export async function getOfflinePlaylists() {
  // Browser path: read downloaded playlists, apply demo masking, and omit empty results.
  if (!shouldUseMobileOfflineSqlite()) {
    return (await getDownloadedPlaylists()).map(maskPlaylist).filter(Boolean);
  }

  // Mobile path: ensure SQLite is ready before reading the playlists.
  await ensureMobileOfflineDbReady();

  // Read playlists with the most recently downloaded first and undated entries last.
  // Query failures propagate to the caller instead of appearing as an empty list.
  const rows = await queryRows(
    `SELECT
        id,
        name,
        total_tracks AS totalTracks,
        total_bytes AS totalBytes,
        download_status AS downloadStatus,
        storage_type AS storageType,
        downloaded_at AS downloadedAt,
        updated_at AS updatedAt
      FROM offline_playlists
      ORDER BY
        CASE WHEN downloaded_at IS NULL THEN 1 ELSE 0 END,
        downloaded_at DESC,
        updated_at DESC`,
    [],
    { rethrow: true },
  );

  // Sanitize the rows, apply demo masking, and omit invalid records.
  return rows.map(sanitizeOfflinePlaylistRow).map(maskPlaylist).filter(Boolean);
}

// Read a playlist's saved tracks in their stored order.
export async function getOfflineTracksForPlaylist(playlistId) {
  // Normalize the playlist ID and return an empty list if it is missing.
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return [];
  }

  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: load playlist membership and downloaded track records together.
    const [playlist, tracks] = await Promise.all([
      getDownloadedPlaylist(normalizedPlaylistId),
      getDownloadedTracks(),
    ]);

    // Return an empty list when the playlist is missing or has no saved track IDs.
    if (!playlist?.trackIds?.length) {
      return [];
    }

    // Index tracks by ID so membership can be resolved without repeated searches.
    const trackMap = new Map(
      tracks.map((track) => [normalizeOfflineId(track?.id), track]),
    );

    // Follow the playlist's saved order and attach browser storage references.
    // Missing records are skipped; remaining tracks are masked for demo mode.
    return playlist.trackIds
      .map((trackId, index) => {
        const normalizedTrackId = normalizeOfflineId(trackId);
        const track = trackMap.get(normalizedTrackId);

        if (!track) {
          return null;
        }

        return {
          ...track,
          trackOrder: index,
          audioLocalUri: null,
          artworkLocalUri: null,
          audioBlobId: normalizeOfflineId(track?.audioBlobId),
          artworkBlobId: normalizeOfflineId(track?.artworkBlobId),
          storageType: "indexeddb_blob",
          downloadStatus: "downloaded",
        };
      })
      .map(maskOfflineTrack)
      .filter(Boolean);
  }

  // Mobile path: ensure SQLite is ready before reading playlist membership.
  await ensureMobileOfflineDbReady();

  // Join track metadata and media references, preserving the saved track order.
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
        pt.track_order AS trackOrder,
        audio.local_uri AS audioLocalUri,
        artwork.local_uri AS artworkLocalUri
      FROM offline_playlist_tracks pt
      INNER JOIN offline_tracks t ON t.id = pt.track_id
      LEFT JOIN offline_media_files audio
        ON audio.track_id = t.id AND audio.media_type = 'audio'
      LEFT JOIN offline_media_files artwork
        ON artwork.track_id = t.id AND artwork.media_type = 'artwork'
      WHERE pt.playlist_id = ?
      ORDER BY pt.track_order ASC`,
    [normalizedPlaylistId],
    { rethrow: true },
  );

  // Sanitize and mask the tracks before returning them in playlist order.
  return rows.map(sanitizeOfflineTrackRow).map(maskOfflineTrack).filter(Boolean);
}

// Save native playlist metadata without changing its track membership.
export async function saveOfflinePlaylistMetadata(playlist) {
  // Normalize the metadata and use one timestamp for this save.
  const now = new Date().toISOString();
  const safePlaylist = sanitizeOfflinePlaylistMetadata(playlist, now);
  const playlistId = safePlaylist.id;

  // Return null when there is no valid playlist ID to save.
  if (!playlistId) {
    return null;
  }

  // Return null outside native Android because this operation writes SQLite metadata.
  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Insert or update metadata in a transaction. Preserve the existing download
  // date when the incoming metadata does not provide one.
  const savedPlaylist = await withMobileOfflineTransaction(async (database) => {
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
          downloaded_at = COALESCE(excluded.downloaded_at, offline_playlists.downloaded_at),
          updated_at = excluded.updated_at`,
      [
        playlistId,
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

    // Read back the saved row so the result includes the persisted download date.
    const rows = await database.query(
      "SELECT * FROM offline_playlists WHERE id = ? LIMIT 1",
      [playlistId],
    );

    return sanitizeOfflinePlaylistRow(rows?.values?.[0] ?? null);
  });

  // Return the sanitized record after commit, or null if the transaction fails.
  return savedPlaylist;
}

// Replace a native playlist's saved membership and track order.
export async function saveOfflinePlaylistTracks(playlistId, trackIds) {
  // Normalize playlist and track IDs, omitting missing track IDs.
  const normalizedPlaylistId = normalizeOfflineId(playlistId);
  const normalizedTrackIds = Array.isArray(trackIds)
    ? trackIds
        .map((trackId) => normalizeOfflineId(trackId))
        .filter((trackId) => trackId !== null)
    : [];

  // Return false when the playlist ID is missing.
  if (!normalizedPlaylistId) {
    return false;
  }

  // Return false outside native Android.
  if (!shouldUseMobileOfflineSqlite()) {
    return false;
  }

  // Replace membership in one transaction so a failed insert restores the old list.
  const result = await withMobileOfflineTransaction(async (database) => {
    // Remove relationships only; track metadata and physical files are retained.
    await database.run(
      "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
      [normalizedPlaylistId],
      false,
    );

    const downloadedAt = new Date().toISOString();

    // Insert each relationship using its array index as the saved track order.
    // Playlist and track metadata must already exist to satisfy foreign keys.
    for (let index = 0; index < normalizedTrackIds.length; index += 1) {
      await database.run(
        `INSERT INTO offline_playlist_tracks (
            playlist_id,
            track_id,
            track_order,
            downloaded_at
          ) VALUES (?, ?, ?, ?)`,
        [normalizedPlaylistId, normalizedTrackIds[index], index, downloadedAt],
        false,
      );
    }

    return true;
  });

  // Report success only after the replacement transaction commits.
  return Boolean(result);
}
