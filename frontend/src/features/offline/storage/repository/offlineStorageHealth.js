import {
  getBulkDownloadedTrackVerification,
  getOfflineStorageSummary as getIndexedDbOfflineStorageSummary,
  hasVerifiedDownloadedTrack,
} from "../offlineStorage";
import { getNativeMediaFileSize } from "../nativeMediaFileStorage";
import {
  normalizeOfflineId,
  normalizeNullableText,
  normalizePositiveInteger,
} from "./offlineMetadataUtils";
import { isSafeMobileLocalUri } from "./offlineMetadata";
import {
  shouldUseMobileOfflineSqlite,
  ensureMobileOfflineDbReady,
  queryRows,
} from "./offlineDbHelpers";
import { getOfflineTrack } from "./offlineTrackRepository";

// Build the verification result used to decide whether a track needs downloading.
function createOfflineVerificationEntry(trackId, overrides = {}) {
  // Start with an unverified track, then apply any metadata and file-check results.
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

// Split track IDs into batches for the bulk SQLite lookup.
function chunkValues(values, chunkSize) {
  const chunks = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

// Check whether one downloaded track has a saved audio file with a nonzero size.
export async function hasVerifiedOfflineTrack(trackId) {
  // normalizeOfflineId() prepares the ID; a missing ID returns false.
  const normalizedTrackId = normalizeOfflineId(trackId);

  if (!normalizedTrackId) {
    return false;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: verify the saved IndexedDB audio blob.
    return hasVerifiedDownloadedTrack(normalizedTrackId);
  }

  // Mobile path: getOfflineTrack() reads the saved track and media references.
  const track = await getOfflineTrack(normalizedTrackId);

  // Return false when the track is missing or its audio reference is unsafe.
  if (!isSafeMobileLocalUri(track?.audioLocalUri)) {
    return false;
  }

  // getNativeMediaFileSize() checks the physical file; a positive size verifies it.
  const sizeBytes = await getNativeMediaFileSize(track.audioLocalUri);
  return Number.isFinite(Number(sizeBytes)) && Number(sizeBytes) > 0;
}

// Verify multiple downloaded tracks before planning which audio files to download.
export async function getBulkOfflineTrackVerification(
  trackIds,
  { chunkSize = 200 } = {},
) {
  // Normalize the requested IDs, remove missing values, and check each unique ID once.
  const normalizedTrackIds = [
    ...new Set(
      (Array.isArray(trackIds) ? trackIds : [])
        .map((trackId) => normalizeOfflineId(trackId))
        .filter((trackId) => trackId !== null),
    ),
  ];
  // Start every requested track as unverified so missing database rows retain a result.
  const verificationMap = new Map(
    normalizedTrackIds.map((trackId) => [
      trackId,
      createOfflineVerificationEntry(trackId),
    ]),
  );

  // An empty request returns the empty map without accessing storage.
  if (normalizedTrackIds.length === 0) {
    return verificationMap;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: verify the requested tracks using IndexedDB audio blobs.
    return getBulkDownloadedTrackVerification(normalizedTrackIds);
  }

  // Mobile path: ensureMobileOfflineDbReady() verifies SQLite before the queries.
  await ensureMobileOfflineDbReady();

  // Use a positive batch size when splitting the requested track IDs.
  const safeChunkSize = Math.max(1, Math.trunc(Number(chunkSize) || 200));
  const trackRows = [];

  // For each batch, queryRows() loads track IDs and their audio and artwork references.
  // Query failures are rethrown so unavailable storage is not treated as missing downloads.
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

  // Check the referenced audio files concurrently after all metadata batches are loaded.
  // Artwork references are recorded here, but their physical files are not verified.
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

  // Update each result with its saved references and actual audio size.
  // A safe audio reference with no nonempty file is marked as broken for retry.
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

  // Return the map used to distinguish verified downloads, missing tracks, and broken refs.
  return verificationMap;
}

// Build the storage summary used when the Downloaded page loads or refreshes.
export async function getOfflineStorageSummary() {
  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: calculate counts and sizes from saved IndexedDB records and blobs.
    return getIndexedDbOfflineStorageSummary();
  }

  // Mobile path: verify SQLite readiness before reading saved download information.
  // Readiness and query failures propagate to the page's storage-unavailable handling.
  await ensureMobileOfflineDbReady();

  // Count saved playlists, then read track media references and stored reference totals.
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

  // Inspect each track's safe local references to calculate actual file sizes and counts.
  for (const row of trackRows) {
    const audioLocalUri = isSafeMobileLocalUri(row?.audioLocalUri)
      ? normalizeNullableText(row.audioLocalUri)
      : null;
    const artworkLocalUri = isSafeMobileLocalUri(row?.artworkLocalUri)
      ? normalizeNullableText(row.artworkLocalUri)
      : null;

    // Missing or unsafe audio references count as missing audio files.
    // Otherwise, count the file as verified only when its size is finite and positive.
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

    // Artwork is optional: an absent or unsafe reference is skipped.
    // A saved safe reference whose file is empty or unavailable counts as missing artwork.
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

  // Combine verified audio and artwork sizes for the total stored media bytes.
  const totalBytes = totalAudioBytes + totalArtworkBytes;

  // Return stored record counts alongside verified file counts, sizes, and missing-file totals.
  // available means the storage read succeeded; individual files may still be missing.
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
