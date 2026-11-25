import { getDownloadedTrack } from "../offlineStorage";
import { maskOfflineTrack } from "../../../../utils/demoMode";
import { normalizeOfflineId, normalizeText } from "./offlineMetadataUtils";
import {
  isSafeMobileLocalUri,
  normalizeOfflineTrackMetadata,
  normalizeOfflineTrackForSave,
  sanitizeOfflineTrackRow,
} from "./offlineMetadata";
import {
  createOfflineMetadataSaveError,
  sanitizeOfflineMetadataError,
  logOfflineMetadataError,
} from "./offlineErrors";
import {
  shouldUseMobileOfflineSqlite,
  ensureMobileOfflineDbReady,
  queryRows,
  withMobileOfflineTransaction,
  normalizeSqliteValue,
  assertValidSqliteValues,
} from "./offlineDbHelpers";

// Read a track from browser storage or native SQLite
export async function getOfflineTrack(trackId) {
  // Normalize the track ID before looking up the saved record.
  const normalizedTrackId = normalizeOfflineId(trackId);

  // Return null if the track ID is missing.
  if (!normalizedTrackId) {
    return null;
  }

  // Browser path: read the downloaded track from IndexedDB.
  if (!shouldUseMobileOfflineSqlite()) {
    return getDownloadedTrack(normalizedTrackId);
  }

  // Mobile path: ensure SQLite is ready before reading the track.
  await ensureMobileOfflineDbReady();

  // Query the track metadata and its audio and artwork references.
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

  // Sanitize the database row and apply demo masking before returning it.
  return maskOfflineTrack(sanitizeOfflineTrackRow(rows?.[0] ?? null));
}

// Save native track metadata
export async function saveOfflineTrackMetadata(track) {
  // Normalize the metadata and use one timestamp for this save.
  const now = new Date().toISOString();
  const safeTrack = normalizeOfflineTrackMetadata(track, now);
  const trackId = safeTrack.id;

  // Reject a missing track ID before opening a transaction.
  if (!trackId) {
    throw createOfflineMetadataSaveError(track, "track ID was missing.");
  }

  // Return null outside native Android because this operation saves SQLite metadata.
  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Prepare and validate the metadata values before sending them to SQLite.
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

  // Insert or update the track in a transaction, preserving its saved download
  // date when the incoming metadata does not provide one.
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

      // Build the metadata result. This operation does not save media references.
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
    // Sanitize and log transaction failures before passing them to the caller.
    const safeError = sanitizeOfflineMetadataError(
      error,
      safeTrack,
      "SQLite metadata save failed.",
    );
    logOfflineMetadataError("saving-track-metadata", safeTrack, safeError);
    throw safeError;
  });

  // Return the result after the transaction commits successfully.
  return savedTrack;
}

// Save a native audio or artwork reference
export async function saveOfflineMediaFileRef(trackId, type, localUri) {
  // Normalize the track ID, media type, and local file reference.
  const normalizedTrackId = normalizeOfflineId(trackId);
  const normalizedType = normalizeText(type).trim().toLowerCase();
  const normalizedLocalUri = normalizeText(localUri).trim();

  // Reject missing identifiers and unsafe references before writing metadata.
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

  // Return null outside native Android because this operation writes SQLite refs.
  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Prepare and validate the values for the media reference.
  const downloadedAt = new Date().toISOString();
  const mediaValues = [
    normalizedTrackId,
    normalizedType,
    normalizedLocalUri,
    "native_file",
    downloadedAt,
  ];
  assertValidSqliteValues(mediaValues, { id: normalizedTrackId }, "media");

  // Insert the reference or update the existing reference for this track and type.
  // The physical audio or artwork file has already been saved by the caller.
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

      // Build the saved reference result without reading the generated row ID.
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
    // Sanitize and log transaction failures before passing them to the caller.
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

  // Return the reference after the transaction commits successfully.
  return savedMediaFile;
}

// Save native track metadata and media references in one transaction
export async function saveOfflineTrackWithMediaRefs(track) {
  // Normalize the track metadata and its audio and artwork references.
  const now = new Date().toISOString();
  const safeTrack = normalizeOfflineTrackForSave(track, now);
  const trackId = safeTrack.id;
  const audioLocalUri = safeTrack.audioLocalUri;
  const artworkLocalUri = safeTrack.artworkLocalUri;

  // Reject a missing track ID before checking the storage platform.
  if (!trackId) {
    throw createOfflineMetadataSaveError(track, "track ID was missing.");
  }

  // Return null outside native Android.
  if (!shouldUseMobileOfflineSqlite()) {
    return null;
  }

  // Require a safe app-local audio reference for the saved track.
  if (!isSafeMobileLocalUri(audioLocalUri)) {
    throw createOfflineMetadataSaveError(
      safeTrack,
      "audio media ref was invalid.",
    );
  }

  // Prepare and validate the track metadata and required audio reference.
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

  // Artwork is optional. Validate and prepare its reference only when provided.
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

  // Save the track and media references in one transaction so any failed write
  // rolls back all database changes in this operation.
  const savedTrack = await withMobileOfflineTransaction(
    async (database) => {
      // Insert or update the track metadata first.
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

      // Save the required audio reference for the track.
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

      // Save the artwork reference when provided; otherwise leave it unchanged.
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

      // Build the track result with the media references supplied for this save.
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
    // Sanitize and log transaction failures before passing them to the caller.
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

  // Return the track only after all database writes commit successfully.
  return savedTrack;
}
