import {
  clearOfflineDownloads,
  deleteDownloadedPlaylist,
  getDownloadedPlaylist,
  getDownloadedPlaylists,
  getDownloadedTrack,
  getDownloadedTracks,
} from "./offlineStorage";
import {
  getMobileOfflineDb,
  initializeMobileOfflineDb,
  isNativeAndroidMobileOfflineSupported,
} from "./mobileSqliteDb";

// Native mobile metadata must never store API tokens, auth headers, or PC file paths.
// Audio files and artwork files will live in native storage later; SQLite only stores metadata and local refs.

function normalizeOfflineId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizePositiveInteger(value, fallback = 0) {
  const normalizedValue = Number(value);

  return Number.isFinite(normalizedValue) && normalizedValue >= 0
    ? Math.trunc(normalizedValue)
    : fallback;
}

function normalizeDownloadStatus(value, fallback = "pending") {
  const status = normalizeText(value, fallback);

  return status || fallback;
}

function normalizeStorageType(value, fallback = "native_file") {
  const storageType = normalizeText(value, fallback);

  return storageType || fallback;
}

function normalizeTimestamp(value) {
  const timestamp = normalizeText(value);

  return timestamp || new Date().toISOString();
}

function isSafeMobileLocalUri(value) {
  const normalizedValue = normalizeText(value).trim();

  if (!normalizedValue) {
    return false;
  }

  // Guard against accidentally persisting raw Windows PC library paths.
  if (/^[a-zA-Z]:[\\/]/.test(normalizedValue) || /^\\\\/.test(normalizedValue)) {
    return false;
  }

  // Only app-local relative refs should be stored here, never traversal paths.
  if (/^\.{1,2}[\\/]/.test(normalizedValue) || /(^|[\\/])\.\.([\\/]|$)/.test(normalizedValue)) {
    return false;
  }

  return true;
}

async function withMobileOfflineTransaction(work) {
  const database = await getMobileOfflineDb();

  if (!database) {
    return null;
  }

  let transactionStarted = false;

  try {
    await database.beginTransaction();
    transactionStarted = true;
    const result = await work(database);
    await database.commitTransaction();
    return result;
  } catch {
    if (transactionStarted) {
      try {
        await database.rollbackTransaction();
      } catch {}
    }

    return null;
  }
}

async function queryRows(statement, values = []) {
  const database = await getMobileOfflineDb();

  if (!database) {
    return [];
  }

  try {
    const result = await database.query(statement, values);
    return Array.isArray(result?.values) ? result.values : [];
  } catch {
    return [];
  }
}

export function shouldUseMobileOfflineSqlite() {
  return isNativeAndroidMobileOfflineSupported();
}

export async function saveOfflineTrackMetadata(track) {
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);

  if (!trackId) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const now = new Date().toISOString();
  const savedTrack = await withMobileOfflineTransaction(async (database) => {
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
        trackId,
        normalizeText(track?.title, "Unknown Title"),
        normalizeText(track?.artist),
        normalizeText(track?.album),
        Number.isFinite(Number(track?.duration)) ? Math.trunc(Number(track.duration)) : null,
        normalizeDownloadStatus(track?.downloadStatus, "pending"),
        normalizeStorageType(track?.storageType, "native_file"),
        track?.downloadedAt ? normalizeTimestamp(track.downloadedAt) : null,
        now,
      ],
      false,
    );

    const rows = await database.query(
      "SELECT * FROM offline_tracks WHERE id = ? LIMIT 1",
      [trackId],
    );

    return rows?.values?.[0] ?? null;
  });

  return savedTrack;
}

export async function saveOfflinePlaylistMetadata(playlist) {
  const playlistId = normalizeOfflineId(playlist?.id);

  if (!playlistId) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const now = new Date().toISOString();
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
        normalizeText(playlist?.name, "Untitled playlist"),
        normalizePositiveInteger(playlist?.totalTracks),
        normalizePositiveInteger(playlist?.totalBytes),
        normalizeDownloadStatus(playlist?.downloadStatus, "pending"),
        normalizeStorageType(playlist?.storageType, "native_file"),
        playlist?.downloadedAt ? normalizeTimestamp(playlist.downloadedAt) : null,
        now,
      ],
      false,
    );

    const rows = await database.query(
      "SELECT * FROM offline_playlists WHERE id = ? LIMIT 1",
      [playlistId],
    );

    return rows?.values?.[0] ?? null;
  });

  return savedPlaylist;
}

export async function saveOfflinePlaylistTracks(playlistId, trackIds) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);
  const normalizedTrackIds = Array.isArray(trackIds)
    ? trackIds
        .map((trackId) => normalizeOfflineId(trackId))
        .filter((trackId) => trackId !== null)
    : [];

  if (!normalizedPlaylistId) {
    return false;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return false;
  }

  const result = await withMobileOfflineTransaction(async (database) => {
    await database.run(
      "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
      [normalizedPlaylistId],
      false,
    );

    const downloadedAt = new Date().toISOString();

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

  return Boolean(result);
}

export async function saveOfflineMediaFileRef(trackId, type, localUri) {
  const normalizedTrackId = normalizeOfflineId(trackId);
  const normalizedType = normalizeText(type).trim().toLowerCase();
  const normalizedLocalUri = normalizeText(localUri).trim();

  if (!normalizedTrackId || !normalizedType || !isSafeMobileLocalUri(normalizedLocalUri)) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const savedMediaFile = await withMobileOfflineTransaction(async (database) => {
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
        normalizedTrackId,
        normalizedType,
        normalizedLocalUri,
        "native_file",
        new Date().toISOString(),
      ],
      false,
    );

    const rows = await database.query(
      `SELECT * FROM offline_media_files
       WHERE track_id = ? AND media_type = ?
       LIMIT 1`,
      [normalizedTrackId, normalizedType],
    );

    return rows?.values?.[0] ?? null;
  });

  return savedMediaFile;
}

export async function getOfflinePlaylists() {
  if (!shouldUseMobileOfflineSqlite()) {
    return getDownloadedPlaylists();
  }

  return queryRows(
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
  );
}

export async function getOfflineTracksForPlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return [];
  }

  if (!shouldUseMobileOfflineSqlite()) {
    const [playlist, tracks] = await Promise.all([
      getDownloadedPlaylist(normalizedPlaylistId),
      getDownloadedTracks(),
    ]);

    if (!playlist?.trackIds?.length) {
      return [];
    }

    const trackMap = new Map(tracks.map((track) => [normalizeOfflineId(track?.id), track]));

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
          storageType: "indexeddb_blob",
          downloadStatus: "downloaded",
        };
      })
      .filter(Boolean);
  }

  return queryRows(
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
  );
}

export async function deleteOfflinePlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return false;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return deleteDownloadedPlaylist(normalizedPlaylistId);
  }

  const result = await withMobileOfflineTransaction(async (database) => {
    const trackRows = await database.query(
      "SELECT track_id AS trackId FROM offline_playlist_tracks WHERE playlist_id = ?",
      [normalizedPlaylistId],
    );
    const trackIds = Array.isArray(trackRows?.values)
      ? trackRows.values
          .map((row) => normalizeOfflineId(row?.trackId))
          .filter((trackId) => trackId !== null)
      : [];

    await database.run(
      "DELETE FROM offline_downloads WHERE entity_type = 'playlist' AND entity_id = ?",
      [normalizedPlaylistId],
      false,
    );
    await database.run(
      "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
      [normalizedPlaylistId],
      false,
    );
    await database.run(
      "DELETE FROM offline_playlists WHERE id = ?",
      [normalizedPlaylistId],
      false,
    );

    for (const trackId of trackIds) {
      const remainingPlaylistRows = await database.query(
        "SELECT COUNT(*) AS count FROM offline_playlist_tracks WHERE track_id = ?",
        [trackId],
      );
      const remainingCount = normalizePositiveInteger(
        remainingPlaylistRows?.values?.[0]?.count,
      );

      if (remainingCount > 0) {
        continue;
      }

      await database.run(
        "DELETE FROM offline_media_files WHERE track_id = ?",
        [trackId],
        false,
      );
      await database.run(
        "DELETE FROM offline_downloads WHERE entity_type = 'track' AND entity_id = ?",
        [trackId],
        false,
      );
      await database.run("DELETE FROM offline_tracks WHERE id = ?", [trackId], false);
    }

    return true;
  });

  return Boolean(result);
}

export async function clearMobileOfflineData() {
  if (!shouldUseMobileOfflineSqlite()) {
    return clearOfflineDownloads();
  }

  const result = await withMobileOfflineTransaction(async (database) => {
    await database.run("DELETE FROM offline_media_files", [], false);
    await database.run("DELETE FROM offline_playlist_tracks", [], false);
    await database.run("DELETE FROM offline_downloads", [], false);
    await database.run("DELETE FROM offline_tracks", [], false);
    await database.run("DELETE FROM offline_playlists", [], false);
    return true;
  });

  return Boolean(result);
}

export { initializeMobileOfflineDb };
