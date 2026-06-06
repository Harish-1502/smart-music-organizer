import {
  OFFLINE_AUDIO_BLOBS_STORE,
  OFFLINE_ARTWORK_BLOBS_STORE,
  OFFLINE_PLAYLISTS_STORE,
  OFFLINE_TRACKS_STORE,
  getOfflineDatabase,
} from "./offlineDb";

// Offline storage must never persist API tokens, auth headers, or local PC file paths.
// This foundation only stores app-owned metadata and blobs for future offline downloads.

const EMPTY_SUMMARY = {
  available: false,
  playlistCount: 0,
  trackCount: 0,
  audioBlobCount: 0,
  artworkBlobCount: 0,
  totalBytes: 0,
};

function normalizeOfflineId(value) {
  return value === null || value === undefined || value === "" ? null : value;
}

function getByteSize(value) {
  const size = Number(value);

  return Number.isFinite(size) && size > 0 ? size : 0;
}

async function readAllFromStore(storeName) {
  const database = await getOfflineDatabase();

  if (!database) {
    return [];
  }

  try {
    return (await database.getAll(storeName)) ?? [];
  } catch {
    return [];
  }
}

export async function getDownloadedPlaylists() {
  return readAllFromStore(OFFLINE_PLAYLISTS_STORE);
}

export async function getDownloadedTracks() {
  return readAllFromStore(OFFLINE_TRACKS_STORE);
}

export async function hasDownloadedPlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (normalizedPlaylistId === null) {
    return false;
  }

  const database = await getOfflineDatabase();

  if (!database) {
    return false;
  }

  try {
    return Boolean(await database.get(OFFLINE_PLAYLISTS_STORE, normalizedPlaylistId));
  } catch {
    return false;
  }
}

export async function getOfflineStorageSummary() {
  const database = await getOfflineDatabase();

  if (!database) {
    return { ...EMPTY_SUMMARY, available: false };
  }

  try {
    const [playlists, tracks, audioBlobs, artworkBlobs] = await Promise.all([
      database.getAll(OFFLINE_PLAYLISTS_STORE),
      database.getAll(OFFLINE_TRACKS_STORE),
      database.getAll(OFFLINE_AUDIO_BLOBS_STORE),
      database.getAll(OFFLINE_ARTWORK_BLOBS_STORE),
    ]);

    const totalBytes = tracks.reduce((sum, track) => sum + getByteSize(track?.sizeBytes), 0);

    return {
      available: true,
      playlistCount: playlists.length,
      trackCount: tracks.length,
      audioBlobCount: audioBlobs.length,
      artworkBlobCount: artworkBlobs.length,
      totalBytes,
    };
  } catch {
    return { ...EMPTY_SUMMARY, available: true };
  }
}

export async function deleteDownloadedPlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (normalizedPlaylistId === null) {
    return false;
  }

  const database = await getOfflineDatabase();

  if (!database) {
    return false;
  }

  try {
    const tx = database.transaction(
      [
        OFFLINE_PLAYLISTS_STORE,
        OFFLINE_TRACKS_STORE,
        OFFLINE_AUDIO_BLOBS_STORE,
        OFFLINE_ARTWORK_BLOBS_STORE,
      ],
      "readwrite",
    );
    const playlistStore = tx.objectStore(OFFLINE_PLAYLISTS_STORE);
    const trackStore = tx.objectStore(OFFLINE_TRACKS_STORE);
    const audioBlobStore = tx.objectStore(OFFLINE_AUDIO_BLOBS_STORE);
    const artworkBlobStore = tx.objectStore(OFFLINE_ARTWORK_BLOBS_STORE);

    const playlist = await playlistStore.get(normalizedPlaylistId);

    if (!playlist) {
      tx.abort();
      await tx.done.catch(() => {});
      return false;
    }

    const playlistTrackIds = new Set(
      Array.isArray(playlist.trackIds)
        ? playlist.trackIds.map(normalizeOfflineId).filter((id) => id !== null)
        : [],
    );

    await playlistStore.delete(normalizedPlaylistId);

    for (const trackId of playlistTrackIds) {
      const track = await trackStore.get(trackId);

      if (!track) {
        continue;
      }

      const remainingPlaylistIds = Array.isArray(track.playlistIds)
        ? [...new Set(
            track.playlistIds
              .map(normalizeOfflineId)
              .filter((id) => id !== null && id !== normalizedPlaylistId),
          )]
        : [];

      if (remainingPlaylistIds.length > 0) {
        await trackStore.put({
          ...track,
          playlistIds: remainingPlaylistIds,
        });
      } else {
        await trackStore.delete(track.id);
      }
    }

    const remainingTracks = await trackStore.getAll();

    const usedAudioBlobIds = new Set(
      remainingTracks
        .map((track) => normalizeOfflineId(track?.audioBlobId))
        .filter((blobId) => blobId !== null),
    );

    const usedArtworkBlobIds = new Set(
      remainingTracks
        .map((track) => normalizeOfflineId(track?.artworkBlobId))
        .filter((blobId) => blobId !== null),
    );

    const allAudioBlobs = await audioBlobStore.getAll();
    for (const blobRecord of allAudioBlobs) {
      if (!usedAudioBlobIds.has(normalizeOfflineId(blobRecord.id))) {
        await audioBlobStore.delete(blobRecord.id);
      }
    }

    const allArtworkBlobs = await artworkBlobStore.getAll();
    for (const blobRecord of allArtworkBlobs) {
      if (!usedArtworkBlobIds.has(normalizeOfflineId(blobRecord.id))) {
        await artworkBlobStore.delete(blobRecord.id);
      }
    }

    await tx.done;
    return true;
  } catch {
    return false;
  }
}

export async function clearOfflineDownloads() {
  const database = await getOfflineDatabase();

  if (!database) {
    return false;
  }

  try {
    await Promise.all([
      database.clear(OFFLINE_PLAYLISTS_STORE),
      database.clear(OFFLINE_TRACKS_STORE),
      database.clear(OFFLINE_AUDIO_BLOBS_STORE),
      database.clear(OFFLINE_ARTWORK_BLOBS_STORE),
    ]);

    return true;
  } catch {
    return false;
  }
}
