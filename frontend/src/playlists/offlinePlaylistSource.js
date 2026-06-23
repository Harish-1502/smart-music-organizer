import {
  buildOfflinePlaybackQueue,
  getOfflinePlaylistForPlayback,
  getOfflinePlaylists,
} from "../offline/mobileOfflineRepository";

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizePlaylistId(value) {
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

function normalizeTrackId(value) {
  return normalizePlaylistId(value);
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}

function normalizeTimestamp(value) {
  const normalizedValue = normalizeText(value).trim();
  return normalizedValue || null;
}

function normalizeSafeOfflineLocalUri(value) {
  const normalizedValue = normalizeText(value).replaceAll("\\", "/").trim();

  if (!normalizedValue) {
    return null;
  }

  if (
    /^[a-zA-Z]:\//.test(normalizedValue) ||
    normalizedValue.startsWith("//") ||
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("file://") ||
    normalizedValue.startsWith("content://") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://")
  ) {
    return null;
  }

  if (
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("/../") ||
    normalizedValue.includes("..\\")
  ) {
    return null;
  }

  return normalizedValue.startsWith("media/") ? normalizedValue : null;
}

function getSafeRelativeFileName(relativePath, fallback) {
  const normalizedValue = normalizeText(relativePath).replaceAll("\\", "/").trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parts = normalizedValue.split("/");
  return parts[parts.length - 1] || fallback;
}

function mapOfflinePlaylistSummary(playlist) {
  const playlistId = normalizePlaylistId(playlist?.id);

  if (!playlistId) {
    return null;
  }

  const updatedAt =
    normalizeTimestamp(playlist?.updatedAt) ??
    normalizeTimestamp(playlist?.downloadedAt) ??
    new Date(0).toISOString();

  return {
    id: playlistId,
    name: normalizeText(playlist?.name, "Untitled playlist"),
    updated_at: updatedAt,
    updatedAt,
    downloadedAt: normalizeTimestamp(playlist?.downloadedAt),
    totalTracks: normalizeCount(playlist?.totalTracks),
    totalBytes: normalizeCount(playlist?.totalBytes),
    storageType: normalizeText(playlist?.storageType, "native_file"),
    offline: true,
  };
}

function mapOfflinePlaylistTrack(track, playlistId) {
  const trackId = normalizeTrackId(track?.id ?? track?.track_id);

  if (!trackId) {
    return null;
  }

  const trackOrder = normalizeCount(track?.trackOrder);
  const fallbackFileName = `offline-${trackId}`;
  const audioLocalUri = normalizeSafeOfflineLocalUri(track?.audioLocalUri);
  const artworkLocalUri = normalizeSafeOfflineLocalUri(track?.artworkLocalUri);

  return {
    id: trackId,
    track_id: trackId,
    playlist_track_id:
      normalizeText(track?.playlist_track_id).trim() ||
      `offline:${playlistId}:${trackId}`,
    position: trackOrder + 1,
    title: normalizeText(track?.title, "Unknown Title"),
    artist: normalizeText(track?.artist),
    album: normalizeText(track?.album),
    duration: normalizeDuration(track?.duration),
    file_name: getSafeRelativeFileName(
      audioLocalUri || artworkLocalUri,
      fallbackFileName,
    ),
    storageType: normalizeText(track?.storageType, "native_file"),
    downloadStatus: normalizeText(track?.downloadStatus, "downloaded"),
    offline: true,
    audioSrc: null,
    artworkSrc: null,
    audioLocalUri,
    artworkLocalUri,
    audioBlobId: normalizeTrackId(track?.audioBlobId),
    artworkBlobId: normalizeTrackId(track?.artworkBlobId),
  };
}

export const offlinePlaylistSource = {
  kind: "offline",
  supportsCreate: false,
  supportsRename: false,
  supportsDelete: false,
  supportsTrackRemoval: false,
  supportsTrackEditing: false,
  supportsOfflineDownload: false,

  async getPlaylists() {
    const playlists = await getOfflinePlaylists();
    return playlists.map(mapOfflinePlaylistSummary).filter(Boolean);
  },

  async getPlaylistDetail(playlistId) {
    const offlinePlaylist = await getOfflinePlaylistForPlayback(playlistId);

    if (!offlinePlaylist?.playlist) {
      return null;
    }

    const mappedPlaylist = mapOfflinePlaylistSummary(offlinePlaylist.playlist);

    if (!mappedPlaylist) {
      return null;
    }

    return {
      ...mappedPlaylist,
      tracks: (offlinePlaylist.tracks || [])
        .map((track) => mapOfflinePlaylistTrack(track, mappedPlaylist.id))
        .filter(Boolean),
    };
  },

  async buildPlaybackQueue(playlistId) {
    return buildOfflinePlaybackQueue(playlistId);
  },
};
