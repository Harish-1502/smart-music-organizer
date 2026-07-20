import {
  clearOfflineDownloads,
  deleteDownloadedPlaylist,
  getBulkDownloadedTrackVerification,
  getDownloadedPlaylist,
  getDownloadedPlaylists,
  getDownloadedTrack,
  getDownloadedTracks,
  getOfflineStorageSummary as getIndexedDbOfflineStorageSummary,
  hasVerifiedDownloadedTrack,
  hasDownloadedPlaylist as hasIndexedDbDownloadedPlaylist,
} from "./offlineStorage";
import {
  getMobileOfflineDb,
  initializeMobileOfflineDb,
  isNativeAndroidMobileOfflineSupported,
  ensureMobileOfflineDbReady as ensureNativeMobileOfflineDbReady,
} from "./mobileSqliteDb";
import {
  clearNativeMediaFiles,
  deleteAudioFile,
  deleteArtworkFile,
  getNativeMediaFileSize,
  getPlayableNativeAudioUri,
  getPlayableNativeArtworkUri,
  nativeMediaFileExists,
} from "./nativeMediaFileStorage";
import {
  formatSafeError,
  getSafeErrorMessage,
} from "../../../utils/formatSafeError";
import {
  hiddenPathValue,
  isDemoMode,
  maskOfflineTrack,
  maskPlaylist,
} from "../../../utils/demoMode";

// Native mobile metadata must never store API tokens, auth headers, or PC file paths.
// Audio files and artwork files will live in native storage later; SQLite only stores metadata and local refs.

export class OfflineMetadataSaveError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OfflineMetadataSaveError";
    this.code = details.code ?? null;
    this.trackId = details.trackId ?? null;
    this.trackTitle = details.trackTitle ?? "";
    this.cause = details.cause;
  }
}

export class OfflineDatabaseUnavailableError extends Error {
  constructor(
    message = "Offline database is unavailable. The phone database could not be opened.",
  ) {
    super(message);
    this.name = "OfflineDatabaseUnavailableError";
  }
}

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

function normalizeNullableText(value) {
  const normalizedValue = normalizeText(value).trim();
  return normalizedValue || null;
}

function normalizeDurationValue(value) {
  const normalizedValue = Number(value);

  return Number.isFinite(normalizedValue) ? Math.trunc(normalizedValue) : null;
}

function isSafeMobileLocalUri(value) {
  const normalizedValue = normalizeText(value).trim();

  if (!normalizedValue) {
    return false;
  }

  // Guard against accidentally persisting raw Windows PC library paths.
  if (
    /^[a-zA-Z]:[\\/]/.test(normalizedValue) ||
    /^\\\\/.test(normalizedValue)
  ) {
    return false;
  }

  if (
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("file://") ||
    normalizedValue.startsWith("content://") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("/data/") ||
    normalizedValue.startsWith("/storage/") ||
    normalizedValue.startsWith("/sdcard/")
  ) {
    return false;
  }

  // Only app-local relative refs should be stored here, never traversal paths.
  if (
    /^\.{1,2}[\\/]/.test(normalizedValue) ||
    /(^|[\\/])\.\.([\\/]|$)/.test(normalizedValue)
  ) {
    return false;
  }

  return true;
}

function sanitizeSafeErrorText(value) {
  const normalizedValue =
    typeof value === "string" ? value.trim().replaceAll("\\", "/") : "";

  if (
    !normalizedValue ||
    /^[a-zA-Z]:\//.test(normalizedValue) ||
    normalizedValue.startsWith("//") ||
    normalizedValue.startsWith("file://") ||
    normalizedValue.startsWith("content://") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("/data/") ||
    normalizedValue.startsWith("/storage/") ||
    normalizedValue.startsWith("/sdcard/") ||
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("/../")
  ) {
    return "";
  }

  return normalizedValue;
}

function buildOfflineTrackLabel(track) {
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);
  const trackTitle = normalizeText(track?.title, "Unknown Title");

  if (trackId) {
    return `Track ${trackId}`;
  }

  return `Track ${trackTitle}`;
}

function createOfflineMetadataSaveError(track, message, details = {}) {
  return new OfflineMetadataSaveError(
    `${buildOfflineTrackLabel(track)} could not be saved: ${message}`,
    {
      trackId: normalizeOfflineId(track?.id ?? track?.trackId),
      trackTitle: normalizeText(track?.title, "Unknown Title"),
      ...details,
    },
  );
}

function sanitizeOfflineMetadataError(error, track, fallbackMessage) {
  if (error instanceof OfflineMetadataSaveError) {
    return error;
  }

  const safeCode =
    typeof error?.code === "string" || typeof error?.code === "number"
      ? String(error.code)
      : "";
  const safeMessage = sanitizeSafeErrorText(error?.message);
  const detailSuffix = [safeCode ? `code ${safeCode}` : "", safeMessage]
    .filter(Boolean)
    .join(" - ");

  return createOfflineMetadataSaveError(
    track,
    detailSuffix || getSafeErrorMessage(error, fallbackMessage),
    {
      code: safeCode || null,
      cause: error,
    },
  );
}

function logOfflineMetadataError(operation, track, error) {
  console.error(
    `[offline-metadata-save:error] ${JSON.stringify(
      {
        operation,
        trackId: normalizeOfflineId(
          track?.id ?? track?.trackId ?? error?.trackId,
        ),
        trackTitle: normalizeText(track?.title ?? error?.trackTitle, ""),
        error: formatSafeError(error),
      },
      null,
      2,
    )}`,
  );
}

function normalizeSqliteValue(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function assertValidSqliteValues(values, track, label) {
  values.forEach((value, index) => {
    if (value === undefined) {
      throw createOfflineMetadataSaveError(
        track,
        `SQLite value ${label}[${index}] was undefined.`,
      );
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      throw createOfflineMetadataSaveError(
        track,
        `SQLite value ${label}[${index}] was not finite.`,
      );
    }
  });
}

export function normalizeOfflineTrackMetadata(
  track,
  now = new Date().toISOString(),
) {
  return {
    id: normalizeOfflineId(track?.id ?? track?.trackId),
    title: normalizeText(track?.title, "Unknown Title"),
    artist: normalizeText(track?.artist),
    album: normalizeText(track?.album),
    duration: normalizeDurationValue(track?.duration),
    downloadStatus: normalizeDownloadStatus(track?.downloadStatus, "pending"),
    storageType: normalizeStorageType(track?.storageType, "native_file"),
    downloadedAt: track?.downloadedAt
      ? normalizeTimestamp(track.downloadedAt)
      : null,
    updatedAt: now,
  };
}

function normalizeOfflineTrackForSave(track, now = new Date().toISOString()) {
  const safeTrack = normalizeOfflineTrackMetadata(track, now);
  const audioLocalUri = normalizeNullableText(track?.audioLocalUri);
  const artworkLocalUri = normalizeNullableText(track?.artworkLocalUri);

  return {
    ...safeTrack,
    audioLocalUri,
    artworkLocalUri,
  };
}

function sanitizeOfflinePlaylistMetadata(
  playlist,
  now = new Date().toISOString(),
) {
  return {
    id: normalizeOfflineId(playlist?.id),
    name: normalizeText(playlist?.name, "Untitled playlist"),
    totalTracks: normalizePositiveInteger(playlist?.totalTracks),
    totalBytes: normalizePositiveInteger(playlist?.totalBytes),
    downloadStatus: normalizeDownloadStatus(
      playlist?.downloadStatus,
      "pending",
    ),
    storageType: normalizeStorageType(playlist?.storageType, "native_file"),
    downloadedAt: playlist?.downloadedAt
      ? normalizeTimestamp(playlist.downloadedAt)
      : null,
    updatedAt: now,
  };
}

function sanitizeOfflineTrackRow(row) {
  const trackId = normalizeOfflineId(row?.id);

  if (!trackId) {
    return null;
  }

  return {
    id: trackId,
    title: normalizeText(row?.title, "Unknown Title"),
    artist: normalizeText(row?.artist),
    album: normalizeText(row?.album),
    duration: Number.isFinite(Number(row?.duration))
      ? Math.trunc(Number(row.duration))
      : null,
    downloadStatus: normalizeDownloadStatus(
      row?.downloadStatus ?? row?.download_status,
    ),
    storageType: normalizeStorageType(
      row?.storageType ?? row?.storage_type,
      "native_file",
    ),
    downloadedAt: row?.downloadedAt ?? row?.downloaded_at ?? null,
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
    trackOrder: Number.isFinite(Number(row?.trackOrder ?? row?.track_order))
      ? Math.trunc(Number(row?.trackOrder ?? row?.track_order))
      : null,
    audioLocalUri: isSafeMobileLocalUri(
      row?.audioLocalUri ?? row?.audio_local_uri,
    )
      ? normalizeNullableText(row?.audioLocalUri ?? row?.audio_local_uri)
      : null,
    artworkLocalUri: isSafeMobileLocalUri(
      row?.artworkLocalUri ?? row?.artwork_local_uri,
    )
      ? normalizeNullableText(row?.artworkLocalUri ?? row?.artwork_local_uri)
      : null,
  };
}

function sanitizeOfflinePlaylistRow(row) {
  const playlistId = normalizeOfflineId(row?.id);

  if (!playlistId) {
    return null;
  }

  return {
    id: playlistId,
    name: normalizeText(row?.name, "Untitled playlist"),
    totalTracks: normalizePositiveInteger(
      row?.totalTracks ?? row?.total_tracks,
    ),
    totalBytes: normalizePositiveInteger(row?.totalBytes ?? row?.total_bytes),
    downloadStatus: normalizeDownloadStatus(
      row?.downloadStatus ?? row?.download_status,
      "pending",
    ),
    storageType: normalizeStorageType(
      row?.storageType ?? row?.storage_type,
      "native_file",
    ),
    downloadedAt: row?.downloadedAt ?? row?.downloaded_at ?? null,
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
  };
}

function sanitizeOfflineMediaFileRow(row) {
  const trackId = normalizeOfflineId(row?.trackId ?? row?.track_id);
  const mediaType = normalizeNullableText(row?.mediaType ?? row?.media_type);
  const localUri = row?.localUri ?? row?.local_uri;

  if (!trackId || !mediaType || !isSafeMobileLocalUri(localUri)) {
    return null;
  }

  return {
    id:
      Number.isFinite(Number(row?.id)) && Number(row?.id) > 0
        ? Math.trunc(Number(row.id))
        : null,
    trackId,
    mediaType,
    localUri: normalizeNullableText(localUri),
    storageType: normalizeStorageType(
      row?.storageType ?? row?.storage_type,
      "native_file",
    ),
    downloadedAt: row?.downloadedAt ?? row?.downloaded_at ?? null,
  };
}

async function withMobileOfflineTransaction(work, options = {}) {
  const database = options?.rethrow
    ? await ensureMobileOfflineDbReady()
    : await getMobileOfflineDb();

  if (!database) {
    if (options?.rethrow) {
      throw new OfflineDatabaseUnavailableError();
    }

    return null;
  }

  let transactionStarted = false;

  try {
    await database.beginTransaction();
    transactionStarted = true;
    const result = await work(database);
    await database.commitTransaction();
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await database.rollbackTransaction();
      } catch {}
    }

    if (options?.rethrow) {
      throw error;
    }

    return null;
  }
}

async function bestEffortDeleteNativeTrackFiles(trackIds) {
  if (!shouldUseMobileOfflineSqlite()) {
    return;
  }

  for (const trackId of trackIds) {
    try {
      await deleteAudioFile(trackId);
    } catch {}

    try {
      await deleteArtworkFile(trackId);
    } catch {}
  }
}

async function queryRows(statement, values = [], options = {}) {
  const database = options?.rethrow
    ? await ensureMobileOfflineDbReady()
    : await getMobileOfflineDb();

  if (!database) {
    if (options?.rethrow) {
      throw new OfflineDatabaseUnavailableError();
    }

    return [];
  }

  try {
    const result = await database.query(statement, values);
    return Array.isArray(result?.values) ? result.values : [];
  } catch (error) {
    if (options?.rethrow) {
      throw error;
    }

    return [];
  }
}

function createOfflineVerificationEntry(trackId, overrides = {}) {
  return {
    trackId,
    hasTrackRow: false,
    hasAudioRef: false,
    hasArtworkRef: false,
    sizeBytes: 0,
    verified: false,
    brokenLocalRef: false,
    existingTrack: null,
    ...overrides,
  };
}

function chunkValues(values, chunkSize) {
  const chunks = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

export function shouldUseMobileOfflineSqlite() {
  return isNativeAndroidMobileOfflineSupported();
}

export async function ensureMobileOfflineDbReady() {
  if (!shouldUseMobileOfflineSqlite()) {
    return false;
  }

  const database = await ensureNativeMobileOfflineDbReady();

  if (!database) {
    throw new OfflineDatabaseUnavailableError();
  }

  return database;
}

export async function hasOfflinePlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return false;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return hasIndexedDbDownloadedPlaylist(normalizedPlaylistId);
  }

  const rows = await queryRows(
    "SELECT id FROM offline_playlists WHERE id = ? LIMIT 1",
    [normalizedPlaylistId],
  );

  return rows.length > 0;
}

export async function getOfflineStorageSummary() {
  if (!shouldUseMobileOfflineSqlite()) {
    return getIndexedDbOfflineStorageSummary();
  }

  await ensureMobileOfflineDbReady();

  const playlistCountRows = await queryRows(
    "SELECT COUNT(*) AS count FROM offline_playlists",
    [],
    { rethrow: true },
  );
  const trackRows = await queryRows(
    `SELECT
        t.id,
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
  const mediaRows = await queryRows(
    `SELECT
        SUM(CASE WHEN media_type = 'audio' THEN 1 ELSE 0 END) AS audioCount,
        SUM(CASE WHEN media_type = 'artwork' THEN 1 ELSE 0 END) AS artworkCount
      FROM offline_media_files`,
    [],
    { rethrow: true },
  );

  let totalAudioBytes = 0;
  let totalArtworkBytes = 0;
  let verifiedAudioFileCount = 0;
  let verifiedArtworkFileCount = 0;
  let missingAudioFileCount = 0;
  let missingArtworkFileCount = 0;

  for (const row of trackRows) {
    const audioLocalUri = isSafeMobileLocalUri(row?.audioLocalUri)
      ? normalizeNullableText(row.audioLocalUri)
      : null;
    const artworkLocalUri = isSafeMobileLocalUri(row?.artworkLocalUri)
      ? normalizeNullableText(row.artworkLocalUri)
      : null;

    if (!audioLocalUri) {
      missingAudioFileCount += 1;
    } else {
      const audioSize = await getNativeMediaFileSize(audioLocalUri);

      if (Number.isFinite(Number(audioSize)) && Number(audioSize) > 0) {
        totalAudioBytes += Number(audioSize);
        verifiedAudioFileCount += 1;
      } else {
        missingAudioFileCount += 1;
      }
    }

    if (!artworkLocalUri) {
      continue;
    }

    const artworkSize = await getNativeMediaFileSize(artworkLocalUri);

    if (Number.isFinite(Number(artworkSize)) && Number(artworkSize) > 0) {
      totalArtworkBytes += Number(artworkSize);
      verifiedArtworkFileCount += 1;
    } else {
      missingArtworkFileCount += 1;
    }
  }

  const totalBytes = totalAudioBytes + totalArtworkBytes;

  return {
    available: true,
    playlistCount: normalizePositiveInteger(playlistCountRows?.[0]?.count),
    trackCount: trackRows.length,
    storageType: "native_file",
    audioBlobCount: normalizePositiveInteger(mediaRows?.[0]?.audioCount),
    artworkBlobCount: normalizePositiveInteger(mediaRows?.[0]?.artworkCount),
    audioFileCount: verifiedAudioFileCount,
    artworkFileCount: verifiedArtworkFileCount,
    totalAudioBytes: normalizePositiveInteger(totalAudioBytes),
    totalArtworkBytes: normalizePositiveInteger(totalArtworkBytes),
    missingAudioFileCount,
    missingArtworkFileCount,
    missingFileCount: missingAudioFileCount + missingArtworkFileCount,
    totalBytes: normalizePositiveInteger(totalBytes),
  };
}

export async function getOfflineTrack(trackId) {
  const normalizedTrackId = normalizeOfflineId(trackId);

  if (!normalizedTrackId) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return getDownloadedTrack(normalizedTrackId);
  }

  await ensureMobileOfflineDbReady();

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
        t.updated_at AS updatedAt,
        audio.local_uri AS audioLocalUri,
        artwork.local_uri AS artworkLocalUri
      FROM offline_tracks t
      LEFT JOIN offline_media_files audio
        ON audio.track_id = t.id AND audio.media_type = 'audio'
      LEFT JOIN offline_media_files artwork
        ON artwork.track_id = t.id AND artwork.media_type = 'artwork'
      WHERE t.id = ?
      LIMIT 1`,
    [normalizedTrackId],
  );

  return maskOfflineTrack(sanitizeOfflineTrackRow(rows?.[0] ?? null));
}

export async function hasVerifiedOfflineTrack(trackId) {
  const normalizedTrackId = normalizeOfflineId(trackId);

  if (!normalizedTrackId) {
    return false;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return hasVerifiedDownloadedTrack(normalizedTrackId);
  }

  const track = await getOfflineTrack(normalizedTrackId);

  if (!isSafeMobileLocalUri(track?.audioLocalUri)) {
    return false;
  }

  const sizeBytes = await getNativeMediaFileSize(track.audioLocalUri);
  return Number.isFinite(Number(sizeBytes)) && Number(sizeBytes) > 0;
}

export async function getBulkOfflineTrackVerification(
  trackIds,
  { chunkSize = 200 } = {},
) {
  const normalizedTrackIds = [
    ...new Set(
      (Array.isArray(trackIds) ? trackIds : [])
        .map((trackId) => normalizeOfflineId(trackId))
        .filter((trackId) => trackId !== null),
    ),
  ];
  const verificationMap = new Map(
    normalizedTrackIds.map((trackId) => [
      trackId,
      createOfflineVerificationEntry(trackId),
    ]),
  );

  if (normalizedTrackIds.length === 0) {
    return verificationMap;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return getBulkDownloadedTrackVerification(normalizedTrackIds);
  }

  await ensureMobileOfflineDbReady();

  const safeChunkSize = Math.max(1, Math.trunc(Number(chunkSize) || 200));
  const trackRows = [];

  for (const chunk of chunkValues(normalizedTrackIds, safeChunkSize)) {
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await queryRows(
      `SELECT
          t.id,
          audio.local_uri AS audioLocalUri,
          artwork.local_uri AS artworkLocalUri
        FROM offline_tracks t
        LEFT JOIN offline_media_files audio
          ON audio.track_id = t.id AND audio.media_type = 'audio'
        LEFT JOIN offline_media_files artwork
          ON artwork.track_id = t.id AND artwork.media_type = 'artwork'
        WHERE t.id IN (${placeholders})`,
      chunk,
      { rethrow: true },
    );
    trackRows.push(...rows);
  }

  const fileChecks = await Promise.all(
    trackRows.map(async (row) => {
      const trackId = normalizeOfflineId(row?.id);
      const audioLocalUri = isSafeMobileLocalUri(row?.audioLocalUri)
        ? normalizeNullableText(row.audioLocalUri)
        : null;
      const artworkLocalUri = isSafeMobileLocalUri(row?.artworkLocalUri)
        ? normalizeNullableText(row.artworkLocalUri)
        : null;
      const sizeBytes = audioLocalUri
        ? Number(await getNativeMediaFileSize(audioLocalUri)) || 0
        : 0;

      return {
        trackId,
        audioLocalUri,
        artworkLocalUri,
        sizeBytes,
      };
    }),
  );

  for (const row of fileChecks) {
    if (!row.trackId) {
      continue;
    }

    verificationMap.set(
      row.trackId,
      createOfflineVerificationEntry(row.trackId, {
        hasTrackRow: true,
        hasAudioRef: Boolean(row.audioLocalUri),
        hasArtworkRef: Boolean(row.artworkLocalUri),
        sizeBytes: row.sizeBytes,
        verified: row.sizeBytes > 0,
        brokenLocalRef: Boolean(row.audioLocalUri) && row.sizeBytes <= 0,
        existingTrack: {
          id: row.trackId,
          audioLocalUri: row.audioLocalUri,
          artworkLocalUri: row.artworkLocalUri,
        },
      }),
    );
  }

  return verificationMap;
}

export async function saveOfflineTrackMetadata(track) {
  const now = new Date().toISOString();
  const safeTrack = normalizeOfflineTrackMetadata(track, now);
  const trackId = safeTrack.id;

  if (!trackId) {
    throw createOfflineMetadataSaveError(track, "track ID was missing.");
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const trackValues = [
    trackId,
    safeTrack.title,
    safeTrack.artist,
    safeTrack.album,
    normalizeSqliteValue(safeTrack.duration),
    safeTrack.downloadStatus,
    safeTrack.storageType,
    normalizeSqliteValue(safeTrack.downloadedAt),
    safeTrack.updatedAt,
  ];
  assertValidSqliteValues(trackValues, safeTrack, "track");

  const savedTrack = await withMobileOfflineTransaction(
    async (database) => {
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
        trackValues,
        false,
      );

      return {
        id: trackId,
        title: safeTrack.title,
        artist: safeTrack.artist,
        album: safeTrack.album,
        duration: safeTrack.duration,
        downloadStatus: safeTrack.downloadStatus,
        storageType: safeTrack.storageType,
        downloadedAt: safeTrack.downloadedAt,
        updatedAt: safeTrack.updatedAt,
        trackOrder: null,
        audioLocalUri: null,
        artworkLocalUri: null,
      };
    },
    { rethrow: true },
  ).catch((error) => {
    const safeError = sanitizeOfflineMetadataError(
      error,
      safeTrack,
      "SQLite metadata save failed.",
    );
    logOfflineMetadataError("saving-track-metadata", safeTrack, safeError);
    throw safeError;
  });

  return savedTrack;
}

export async function saveOfflinePlaylistMetadata(playlist) {
  const now = new Date().toISOString();
  const safePlaylist = sanitizeOfflinePlaylistMetadata(playlist, now);
  const playlistId = safePlaylist.id;

  if (!playlistId) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

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

    const rows = await database.query(
      "SELECT * FROM offline_playlists WHERE id = ? LIMIT 1",
      [playlistId],
    );

    return sanitizeOfflinePlaylistRow(rows?.values?.[0] ?? null);
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

  if (!normalizedTrackId) {
    throw createOfflineMetadataSaveError(
      { id: trackId },
      "media ref track ID was missing.",
    );
  }

  if (!normalizedType) {
    throw createOfflineMetadataSaveError(
      { id: normalizedTrackId },
      "media ref type was missing.",
    );
  }

  if (!isSafeMobileLocalUri(normalizedLocalUri)) {
    throw createOfflineMetadataSaveError(
      { id: normalizedTrackId },
      `${normalizedType} media ref was invalid.`,
    );
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const downloadedAt = new Date().toISOString();
  const mediaValues = [
    normalizedTrackId,
    normalizedType,
    normalizedLocalUri,
    "native_file",
    downloadedAt,
  ];
  assertValidSqliteValues(mediaValues, { id: normalizedTrackId }, "media");

  const savedMediaFile = await withMobileOfflineTransaction(
    async (database) => {
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
        mediaValues,
        false,
      );

      return {
        id: null,
        trackId: normalizedTrackId,
        mediaType: normalizedType,
        localUri: normalizedLocalUri,
        storageType: "native_file",
        downloadedAt,
      };
    },
    { rethrow: true },
  ).catch((error) => {
    const safeError = sanitizeOfflineMetadataError(
      error,
      { id: normalizedTrackId },
      "SQLite media ref save failed.",
    );
    logOfflineMetadataError(
      "saving-media-ref",
      { id: normalizedTrackId },
      safeError,
    );
    throw safeError;
  });

  return savedMediaFile;
}

export async function saveOfflineTrackWithMediaRefs(track) {
  const now = new Date().toISOString();
  const safeTrack = normalizeOfflineTrackForSave(track, now);
  const trackId = safeTrack.id;
  const audioLocalUri = safeTrack.audioLocalUri;
  const artworkLocalUri = safeTrack.artworkLocalUri;

  if (!trackId) {
    throw createOfflineMetadataSaveError(track, "track ID was missing.");
  }

  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  if (!isSafeMobileLocalUri(audioLocalUri)) {
    throw createOfflineMetadataSaveError(
      safeTrack,
      "audio media ref was invalid.",
    );
  }

  const trackValues = [
    trackId,
    safeTrack.title,
    safeTrack.artist,
    safeTrack.album,
    normalizeSqliteValue(safeTrack.duration),
    safeTrack.downloadStatus,
    safeTrack.storageType,
    normalizeSqliteValue(safeTrack.downloadedAt),
    safeTrack.updatedAt,
  ];
  assertValidSqliteValues(trackValues, safeTrack, "track");

  const audioMediaValues = [
    trackId,
    "audio",
    audioLocalUri,
    "native_file",
    normalizeSqliteValue(safeTrack.downloadedAt),
  ];
  assertValidSqliteValues(audioMediaValues, safeTrack, "audioMedia");

  let artworkMediaValues = null;
  if (artworkLocalUri !== null) {
    if (!isSafeMobileLocalUri(artworkLocalUri)) {
      throw createOfflineMetadataSaveError(
        safeTrack,
        "artwork media ref was invalid.",
      );
    }

    artworkMediaValues = [
      trackId,
      "artwork",
      artworkLocalUri,
      "native_file",
      normalizeSqliteValue(safeTrack.downloadedAt),
    ];
    assertValidSqliteValues(artworkMediaValues, safeTrack, "artworkMedia");
  }

  const savedTrack = await withMobileOfflineTransaction(
    async (database) => {
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
        trackValues,
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
        audioMediaValues,
        false,
      );

      if (artworkMediaValues) {
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
          artworkMediaValues,
          false,
        );
      }

      return {
        id: trackId,
        title: safeTrack.title,
        artist: safeTrack.artist,
        album: safeTrack.album,
        duration: safeTrack.duration,
        downloadStatus: safeTrack.downloadStatus,
        storageType: safeTrack.storageType,
        downloadedAt: safeTrack.downloadedAt,
        updatedAt: safeTrack.updatedAt,
        trackOrder: null,
        audioLocalUri,
        artworkLocalUri,
      };
    },
    { rethrow: true },
  ).catch((error) => {
    const safeError = sanitizeOfflineMetadataError(
      error,
      safeTrack,
      "SQLite track/media save failed.",
    );
    logOfflineMetadataError(
      "saving-track-and-media-refs",
      safeTrack,
      safeError,
    );
    throw safeError;
  });

  return savedTrack;
}

export async function saveNativeDownloadedPlaylist(downloadPayload) {
  const normalizedPlaylistId = normalizeOfflineId(downloadPayload?.id);

  if (!normalizedPlaylistId || !shouldUseMobileOfflineSqlite()) {
    return null;
  }

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

  if (safeTracks.length === 0) {
    return null;
  }

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

  const transactionResult = await withMobileOfflineTransaction(
    async (database) => {
      const previousTrackRows = await database.query(
        "SELECT track_id AS trackId FROM offline_playlist_tracks WHERE playlist_id = ?",
        [normalizedPlaylistId],
      );
      const previousTrackIds = Array.isArray(previousTrackRows?.values)
        ? previousTrackRows.values
            .map((row) => normalizeOfflineId(row?.trackId))
            .filter((trackId) => trackId !== null)
        : [];

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

      await database.run(
        "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
        [normalizedPlaylistId],
        false,
      );

      const savedTrackIds = [];

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

        if (remainingCount > 0) {
          continue;
        }

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

  if (!transactionResult?.playlist) {
    return null;
  }

  await bestEffortDeleteNativeTrackFiles(
    transactionResult.removedExclusiveTrackIds ?? [],
  );

  return transactionResult.playlist;
}

export async function getOfflinePlaylists() {
  if (!shouldUseMobileOfflineSqlite()) {
    return (await getDownloadedPlaylists()).map(maskPlaylist).filter(Boolean);
  }

  await ensureMobileOfflineDbReady();

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

  return rows.map(sanitizeOfflinePlaylistRow).map(maskPlaylist).filter(Boolean);
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

    const trackMap = new Map(
      tracks.map((track) => [normalizeOfflineId(track?.id), track]),
    );

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

  await ensureMobileOfflineDbReady();

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

  return rows.map(sanitizeOfflineTrackRow).map(maskOfflineTrack).filter(Boolean);
}

function buildSafeOfflineLibraryTrack(track) {
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);

  if (!trackId) {
    return null;
  }

  const audioLocalUri = isSafeMobileLocalUri(track?.audioLocalUri)
    ? normalizeNullableText(track.audioLocalUri)
    : null;
  const artworkLocalUri = isSafeMobileLocalUri(track?.artworkLocalUri)
    ? normalizeNullableText(track.artworkLocalUri)
    : null;
  const fileNameSource = audioLocalUri ?? artworkLocalUri ?? "";
  const safeFileName = fileNameSource
    ? fileNameSource.split("/").pop() || fileNameSource
    : `offline-${trackId}`;

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

export async function getOfflineLibraryTracks() {
  if (!shouldUseMobileOfflineSqlite()) {
    const tracks = await getDownloadedTracks();

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

  return rows.map(buildSafeOfflineLibraryTrack).map(maskOfflineTrack).filter(Boolean);
}

function buildSafePlaybackTrack(track, sourceFields = {}) {
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);

  if (!trackId) {
    return null;
  }

  return {
    id: trackId,
    title: normalizeText(track?.title, "Unknown Title"),
    artist: normalizeText(track?.artist),
    album: normalizeText(track?.album),
    duration: Number.isFinite(Number(track?.duration))
      ? Math.trunc(Number(track.duration))
      : null,
    offline: true,
    storageType: normalizeStorageType(track?.storageType, "native_file"),
    ...sourceFields,
  };
}

async function buildNativeOfflinePlaybackTrack(track) {
  if (!isSafeMobileLocalUri(track?.audioLocalUri)) {
    return null;
  }

  const audioSrc = await getPlayableNativeAudioUri(track.audioLocalUri);

  if (!audioSrc) {
    return null;
  }

  let artworkSrc = null;

  if (isSafeMobileLocalUri(track?.artworkLocalUri)) {
    try {
      artworkSrc = await getPlayableNativeArtworkUri(track.artworkLocalUri);
    } catch {
      artworkSrc = null;
    }
  }

  return buildSafePlaybackTrack(track, {
    audioSrc,
    artworkSrc,
    audioBlobId: null,
    artworkBlobId: null,
  });
}

function buildBrowserOfflinePlaybackTrack(track) {
  const audioBlobId = normalizeOfflineId(track?.audioBlobId);

  if (!audioBlobId) {
    return null;
  }

  return buildSafePlaybackTrack(track, {
    audioSrc: null,
    artworkSrc: null,
    audioBlobId,
    artworkBlobId: normalizeOfflineId(track?.artworkBlobId),
  });
}

export async function getOfflineTrackAudioSource(trackId) {
  const track = await getOfflineTrack(trackId);

  if (!track) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    const audioBlobId = normalizeOfflineId(track?.audioBlobId);

    return audioBlobId
      ? {
          audioSrc: null,
          audioBlobId,
          storageType: "indexeddb_blob",
        }
      : null;
  }

  if (!isSafeMobileLocalUri(track?.audioLocalUri)) {
    return null;
  }

  const audioSrc = await getPlayableNativeAudioUri(track.audioLocalUri);

  return audioSrc
    ? {
        audioSrc,
        audioBlobId: null,
        storageType: "native_file",
      }
    : null;
}

export async function getOfflinePlaylistForPlayback(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return null;
  }

  const [playlists, tracks] = await Promise.all([
    getOfflinePlaylists(),
    getOfflineTracksForPlaylist(normalizedPlaylistId),
  ]);

  const playlist =
    playlists.find((entry) => entry.id === normalizedPlaylistId) ?? null;

  if (!playlist) {
    return null;
  }

  return {
    playlist,
    tracks,
  };
}

export async function buildOfflinePlaybackQueue(playlistId) {
  const offlinePlaylist = await getOfflinePlaylistForPlayback(playlistId);

  if (!offlinePlaylist) {
    return null;
  }

  const missingTrackIds = [];
  const playableTracks = [];

  for (const track of offlinePlaylist.tracks) {
    const resolvedTrack = shouldUseMobileOfflineSqlite()
      ? await buildNativeOfflinePlaybackTrack(track)
      : buildBrowserOfflinePlaybackTrack(track);

    if (!resolvedTrack) {
      const missingTrackId = normalizeOfflineId(track?.id ?? track?.trackId);

      if (missingTrackId) {
        missingTrackIds.push(missingTrackId);
      }

      continue;
    }

    playableTracks.push(resolvedTrack);
  }

  return {
    playlistId: offlinePlaylist.playlist.id,
    playlistName: offlinePlaylist.playlist.name,
    totalTracks: offlinePlaylist.tracks.length,
    tracks: playableTracks,
    missingTrackIds,
  };
}

function countTracksWithLocalUri(tracks, key) {
  return tracks.filter((track) => normalizeNullableText(track?.[key])).length;
}

async function inspectTrackMediaFiles(tracks, key) {
  const details = [];

  for (const track of tracks) {
    const relativePath = normalizeNullableText(track?.[key]);

    if (!relativePath) {
      continue;
    }

    const exists = await nativeMediaFileExists(relativePath);
    const sizeBytes = exists
      ? await getNativeMediaFileSize(relativePath)
      : null;

    details.push({
      trackId: normalizeOfflineId(track?.id),
      relativePath: isDemoMode() ? hiddenPathValue() : relativePath,
      exists,
      sizeBytes: normalizePositiveInteger(sizeBytes, 0),
    });
  }

  return details;
}

export async function inspectNativeMediaFilesForPlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId || !shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const tracks = await getOfflineTracksForPlaylist(normalizedPlaylistId);
  const audioFiles = await inspectTrackMediaFiles(tracks, "audioLocalUri");
  const artworkFiles = await inspectTrackMediaFiles(tracks, "artworkLocalUri");
  const sqliteAudioMediaRefCount = countTracksWithLocalUri(
    tracks,
    "audioLocalUri",
  );
  const sqliteArtworkMediaRefCount = countTracksWithLocalUri(
    tracks,
    "artworkLocalUri",
  );

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

export async function inspectDownloadedPlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId || !shouldUseMobileOfflineSqlite()) {
    return null;
  }

  const [playlists, trackInspection] = await Promise.all([
    getOfflinePlaylists(),
    inspectNativeMediaFilesForPlaylist(normalizedPlaylistId),
  ]);

  const playlist =
    playlists.find((entry) => entry.id === normalizedPlaylistId) ?? null;

  if (!playlist || !trackInspection) {
    return null;
  }

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

    const deletedTrackIds = [];

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
      await database.run(
        "DELETE FROM offline_tracks WHERE id = ?",
        [trackId],
        false,
      );
      deletedTrackIds.push(trackId);
    }

    return {
      deletedTrackIds,
    };
  });

  if (!result) {
    return false;
  }

  await bestEffortDeleteNativeTrackFiles(result.deletedTrackIds ?? []);
  return true;
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

  if (!result) {
    return false;
  }

  try {
    await clearNativeMediaFiles();
  } catch {}

  return true;
}

export async function clearOfflineData() {
  return shouldUseMobileOfflineSqlite()
    ? clearMobileOfflineData()
    : clearOfflineDownloads();
}

export { initializeMobileOfflineDb };
