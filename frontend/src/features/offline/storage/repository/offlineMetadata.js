import {
  normalizeOfflineId,
  normalizeText,
  normalizePositiveInteger,
  normalizeDownloadStatus,
  normalizeStorageType,
  normalizeTimestamp,
  normalizeNullableText,
  normalizeDurationValue,
} from "./offlineMetadataUtils";

// Pure metadata transformations. Storage access belongs in the repository.

export function isSafeMobileLocalUri(value) {
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

export function normalizeOfflineTrackForSave(track, now = new Date().toISOString()) {
  const safeTrack = normalizeOfflineTrackMetadata(track, now);
  const audioLocalUri = normalizeNullableText(track?.audioLocalUri);
  const artworkLocalUri = normalizeNullableText(track?.artworkLocalUri);

  return {
    ...safeTrack,
    audioLocalUri,
    artworkLocalUri,
  };
}

export function sanitizeOfflinePlaylistMetadata(
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

export function sanitizeOfflineTrackRow(row) {
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

export function sanitizeOfflinePlaylistRow(row) {
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

export function sanitizeOfflineMediaFileRow(row) {
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