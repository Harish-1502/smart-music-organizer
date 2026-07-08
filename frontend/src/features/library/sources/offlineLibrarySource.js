import { getOfflineLibraryTracks } from "../../offline/storage/mobileOfflineRepository";

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeTrackId(value) {
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

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function formatDurationLabel(duration) {
  if (!Number.isFinite(duration) || duration < 0) {
    return null;
  }

  const totalSeconds = Math.floor(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function safeTrackText(value, fallback = "") {
  return normalizeText(value, fallback).trim();
}

function getTrackArtistFilterValue(track) {
  return safeTrackText(track.artist) || "Unknown Artist";
}

function getTrackAlbumFilterValue(track) {
  return safeTrackText(track.album) || "Unknown Album";
}

function getTrackFileName(track) {
  const explicitFileName = safeTrackText(track.file_name);

  if (explicitFileName) {
    return explicitFileName;
  }

  const relativePath =
    safeTrackText(track.audioLocalUri) || safeTrackText(track.artworkLocalUri);

  if (relativePath) {
    const relativePathParts = relativePath.split("/");
    return (
      relativePathParts[relativePathParts.length - 1] || `offline-${track.id}`
    );
  }

  return `offline-${track.id}`;
}

function normalizeOfflineTrack(track) {
  const trackId = normalizeTrackId(track?.id ?? track?.track_id);

  if (!trackId) {
    return null;
  }

  const duration = normalizeDuration(track?.duration);

  return {
    id: trackId,
    track_id: trackId,
    title: safeTrackText(track?.title, "Unknown Title"),
    artist: safeTrackText(track?.artist),
    album: safeTrackText(track?.album),
    duration,
    durationLabel: formatDurationLabel(duration),
    file_name: getTrackFileName(track),
    offline: true,
    storageType: safeTrackText(track?.storageType, "indexeddb_blob"),
    downloadStatus: safeTrackText(track?.downloadStatus, "downloaded"),
    audioSrc: safeTrackText(track?.audioSrc) || null,
    artworkSrc: safeTrackText(track?.artworkSrc) || null,
    audioLocalUri: safeTrackText(track?.audioLocalUri) || null,
    artworkLocalUri: safeTrackText(track?.artworkLocalUri) || null,
    audioBlobId: normalizeTrackId(track?.audioBlobId),
    artworkBlobId: normalizeTrackId(track?.artworkBlobId),
  };
}

function includesFilterValue(sourceValue, filterValue) {
  if (!filterValue) {
    return true;
  }

  return sourceValue.toLowerCase().includes(filterValue.toLowerCase());
}

function equalsFilterValue(sourceValue, filterValue) {
  if (!filterValue) {
    return true;
  }

  return sourceValue.toLowerCase() === filterValue.toLowerCase();
}

function hasMatchingExtension(track, extensionFilter) {
  if (!extensionFilter) {
    return true;
  }

  const normalizedExtension = extensionFilter
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  const fileName = getTrackFileName(track).toLowerCase();

  return fileName.endsWith(`.${normalizedExtension}`);
}

function matchesSearch(track, search) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const haystack = [
    track.title,
    getTrackArtistFilterValue(track),
    getTrackAlbumFilterValue(track),
    getTrackFileName(track),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function sortTracks(tracks, sortBy = "title", order = "asc") {
  const direction = String(order).toLowerCase() === "desc" ? -1 : 1;

  return [...tracks].sort((left, right) => {
    let leftValue = "";
    let rightValue = "";

    if (sortBy === "artist") {
      leftValue = getTrackArtistFilterValue(left);
      rightValue = getTrackArtistFilterValue(right);
    } else if (sortBy === "album") {
      leftValue = getTrackAlbumFilterValue(left);
      rightValue = getTrackAlbumFilterValue(right);
    } else if (sortBy === "duration") {
      leftValue = Number(left.duration ?? -1);
      rightValue = Number(right.duration ?? -1);
    } else if (sortBy === "file_name") {
      leftValue = getTrackFileName(left);
      rightValue = getTrackFileName(right);
    } else {
      leftValue = safeTrackText(left[sortBy], left.title);
      rightValue = safeTrackText(right[sortBy], right.title);
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      if (leftValue === rightValue) {
        return left.title.localeCompare(right.title) * direction;
      }

      return (leftValue - rightValue) * direction;
    }

    const comparedValue = String(leftValue).localeCompare(
      String(rightValue),
      undefined,
      {
        sensitivity: "base",
        numeric: true,
      },
    );

    if (comparedValue === 0) {
      return (
        left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
          numeric: true,
        }) * direction
      );
    }

    return comparedValue * direction;
  });
}

function paginateTracks(tracks, page = 1, pageSize = 25) {
  const normalizedPageSize = Math.max(1, Math.trunc(Number(pageSize) || 25));
  const normalizedPage = Math.max(1, Math.trunc(Number(page) || 1));
  const totalItems = tracks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const safePage = Math.min(normalizedPage, totalPages);
  const startIndex = (safePage - 1) * normalizedPageSize;

  return {
    items: tracks.slice(startIndex, startIndex + normalizedPageSize),
    page: safePage,
    page_size: normalizedPageSize,
    total_items: totalItems,
    total_pages: totalPages,
  };
}

function buildArtists(tracks) {
  const artistCounts = new Map();

  for (const track of tracks) {
    const artistName = getTrackArtistFilterValue(track);
    artistCounts.set(artistName, (artistCounts.get(artistName) ?? 0) + 1);
  }

  return [...artistCounts.entries()]
    .map(([artist, trackCount]) => ({
      artist,
      track_count: trackCount,
    }))
    .sort((left, right) =>
      left.artist.localeCompare(right.artist, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
}

function buildAlbums(tracks) {
  const albumCounts = new Map();

  for (const track of tracks) {
    const albumName = getTrackAlbumFilterValue(track);
    const artistName = getTrackArtistFilterValue(track);
    const key = `${albumName}::${artistName}`;
    const currentCount = albumCounts.get(key) ?? {
      album: albumName,
      artist: artistName,
      track_count: 0,
    };

    currentCount.track_count += 1;
    albumCounts.set(key, currentCount);
  }

  return [...albumCounts.values()].sort((left, right) => {
    const albumCompare = left.album.localeCompare(right.album, undefined, {
      sensitivity: "base",
      numeric: true,
    });

    if (albumCompare !== 0) {
      return albumCompare;
    }

    return left.artist.localeCompare(right.artist, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

export const offlineLibrarySource = {
  kind: "offline",

  async getTracks(params = {}) {
    const allTracks = (await getOfflineLibraryTracks())
      .map(normalizeOfflineTrack)
      .filter(Boolean);

    const filteredTracks = allTracks.filter((track) => {
      const artistValue = getTrackArtistFilterValue(track);
      const albumValue = getTrackAlbumFilterValue(track);

      return (
        matchesSearch(track, normalizeText(params.search, "")) &&
        includesFilterValue(artistValue, normalizeText(params.artist, "")) &&
        equalsFilterValue(artistValue, normalizeText(params.exactArtist, "")) &&
        includesFilterValue(albumValue, normalizeText(params.album, "")) &&
        equalsFilterValue(albumValue, normalizeText(params.exactAlbum, "")) &&
        hasMatchingExtension(track, normalizeText(params.extension, ""))
      );
    });

    return paginateTracks(
      sortTracks(filteredTracks, params.sortBy, params.order),
      params.page,
      params.pageSize,
    );
  },

  async getArtists() {
    const allTracks = (await getOfflineLibraryTracks())
      .map(normalizeOfflineTrack)
      .filter(Boolean);
    return buildArtists(allTracks);
  },

  async getAlbums() {
    const allTracks = (await getOfflineLibraryTracks())
      .map(normalizeOfflineTrack)
      .filter(Boolean);
    return buildAlbums(allTracks);
  },
};
