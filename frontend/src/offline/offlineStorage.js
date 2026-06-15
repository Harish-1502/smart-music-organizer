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
  storageType: "indexeddb",
  audioBlobCount: 0,
  artworkBlobCount: 0,
  totalAudioBytes: 0,
  totalArtworkBytes: 0,
  missingAudioFileCount: 0,
  missingArtworkFileCount: 0,
  missingFileCount: 0,
  totalBytes: 0,
};

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

function normalizeOfflineIdList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(normalizeOfflineId).filter((id) => id !== null))];
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeDuration(value) {
  const duration = Number(value);

  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function getByteSize(value) {
  const size = Number(value);

  return Number.isFinite(size) && size > 0 ? size : 0;
}

function getBlobByteSize(record) {
  return record?.blob instanceof Blob ? getByteSize(record.blob.size) : 0;
}

function buildAudioBlobId(trackId) {
  const normalizedTrackId = normalizeOfflineId(trackId);

  return normalizedTrackId === null ? null : `track:${String(normalizedTrackId)}:audio`;
}

function buildArtworkBlobId(trackId) {
  const normalizedTrackId = normalizeOfflineId(trackId);

  return normalizedTrackId === null ? null : `track:${String(normalizedTrackId)}:artwork`;
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

async function readRecordFromStore(storeName, recordId) {
  const normalizedRecordId = normalizeOfflineId(recordId);

  if (normalizedRecordId === null) {
    return null;
  }

  const database = await getOfflineDatabase();

  if (!database) {
    return null;
  }

  try {
    return (await database.get(storeName, normalizedRecordId)) ?? null;
  } catch {
    return null;
  }
}

async function createBlobUrlFromStore(storeName, recordId) {
  const record = await readRecordFromStore(storeName, recordId);

  if (!(record?.blob instanceof Blob)) {
    return null;
  }

  return URL.createObjectURL(record.blob);
}

async function getBlobSizeFromStore(storeName, recordId) {
  const record = await readRecordFromStore(storeName, recordId);

  if (!(record?.blob instanceof Blob)) {
    return 0;
  }

  return getByteSize(record.blob.size);
}

function getTransactionStores(transaction) {
  return {
    playlistStore: transaction.objectStore(OFFLINE_PLAYLISTS_STORE),
    trackStore: transaction.objectStore(OFFLINE_TRACKS_STORE),
    audioBlobStore: transaction.objectStore(OFFLINE_AUDIO_BLOBS_STORE),
    artworkBlobStore: transaction.objectStore(OFFLINE_ARTWORK_BLOBS_STORE),
  };
}

async function cleanupUnreferencedBlobs({
  trackStore,
  audioBlobStore,
  artworkBlobStore,
}) {
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
}

export async function getDownloadedPlaylists() {
  return readAllFromStore(OFFLINE_PLAYLISTS_STORE);
}

export async function getDownloadedPlaylist(playlistId) {
  return readRecordFromStore(OFFLINE_PLAYLISTS_STORE, playlistId);
}

export async function getDownloadedTracks() {
  return readAllFromStore(OFFLINE_TRACKS_STORE);
}

export async function getDownloadedTrack(trackId) {
  return readRecordFromStore(OFFLINE_TRACKS_STORE, trackId);
}

export async function hasVerifiedDownloadedTrack(trackId) {
  const track = await getDownloadedTrack(trackId);
  const audioBlobId = normalizeOfflineId(track?.audioBlobId);

  if (audioBlobId === null) {
    return false;
  }

  const audioBlobSize = await getBlobSizeFromStore(
    OFFLINE_AUDIO_BLOBS_STORE,
    audioBlobId,
  );

  return audioBlobSize > 0;
}

export async function createOfflineAudioBlobUrl(blobId) {
  return createBlobUrlFromStore(OFFLINE_AUDIO_BLOBS_STORE, blobId);
}

export async function createOfflineArtworkBlobUrl(blobId) {
  return createBlobUrlFromStore(OFFLINE_ARTWORK_BLOBS_STORE, blobId);
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
    return { ...EMPTY_SUMMARY, available: false, storageType: "indexeddb" };
  }

  try {
    const [playlists, tracks, audioBlobs, artworkBlobs] = await Promise.all([
      database.getAll(OFFLINE_PLAYLISTS_STORE),
      database.getAll(OFFLINE_TRACKS_STORE),
      database.getAll(OFFLINE_AUDIO_BLOBS_STORE),
      database.getAll(OFFLINE_ARTWORK_BLOBS_STORE),
    ]);

    const audioBlobIds = new Set(
      audioBlobs
        .map((blobRecord) => normalizeOfflineId(blobRecord?.id))
        .filter((blobId) => blobId !== null),
    );
    const artworkBlobIds = new Set(
      artworkBlobs
        .map((blobRecord) => normalizeOfflineId(blobRecord?.id))
        .filter((blobId) => blobId !== null),
    );
    const totalAudioBytes = audioBlobs.reduce(
      (sum, blobRecord) => sum + getBlobByteSize(blobRecord),
      0,
    );
    const totalArtworkBytes = artworkBlobs.reduce(
      (sum, blobRecord) => sum + getBlobByteSize(blobRecord),
      0,
    );
    const missingAudioFileCount = tracks.filter((track) => {
      const audioBlobId = normalizeOfflineId(track?.audioBlobId);
      return audioBlobId === null || !audioBlobIds.has(audioBlobId);
    }).length;
    const missingArtworkFileCount = tracks.filter((track) => {
      const artworkBlobId = normalizeOfflineId(track?.artworkBlobId);
      return artworkBlobId !== null && !artworkBlobIds.has(artworkBlobId);
    }).length;
    const totalBytes = totalAudioBytes + totalArtworkBytes;

    return {
      available: true,
      playlistCount: playlists.length,
      trackCount: tracks.length,
      storageType: "indexeddb",
      audioBlobCount: audioBlobs.length,
      artworkBlobCount: artworkBlobs.length,
      totalAudioBytes,
      totalArtworkBytes,
      missingAudioFileCount,
      missingArtworkFileCount,
      missingFileCount: missingAudioFileCount + missingArtworkFileCount,
      totalBytes,
    };
  } catch {
    return { ...EMPTY_SUMMARY, available: true, storageType: "indexeddb" };
  }
}

export async function saveOfflineAudioBlob(trackId, blob, options = {}) {
  const normalizedTrackId = normalizeOfflineId(trackId);

  if (normalizedTrackId === null || !(blob instanceof Blob)) {
    return null;
  }

  const blobId = buildAudioBlobId(normalizedTrackId);
  const audioBlobStore = options.audioBlobStore;

  if (!audioBlobStore) {
    const database = await getOfflineDatabase();

    if (!database) {
      return null;
    }

    try {
      const tx = database.transaction([OFFLINE_AUDIO_BLOBS_STORE], "readwrite");
      await tx.objectStore(OFFLINE_AUDIO_BLOBS_STORE).put({ id: blobId, blob });
      await tx.done;
      return blobId;
    } catch {
      return null;
    }
  }

  await audioBlobStore.put({ id: blobId, blob });
  return blobId;
}

export async function saveOfflineArtworkBlob(trackId, blob, options = {}) {
  const normalizedTrackId = normalizeOfflineId(trackId);

  if (normalizedTrackId === null || !(blob instanceof Blob)) {
    return null;
  }

  const blobId = buildArtworkBlobId(normalizedTrackId);
  const artworkBlobStore = options.artworkBlobStore;

  if (!artworkBlobStore) {
    const database = await getOfflineDatabase();

    if (!database) {
      return null;
    }

    try {
      const tx = database.transaction([OFFLINE_ARTWORK_BLOBS_STORE], "readwrite");
      await tx.objectStore(OFFLINE_ARTWORK_BLOBS_STORE).put({ id: blobId, blob });
      await tx.done;
      return blobId;
    } catch {
      return null;
    }
  }

  await artworkBlobStore.put({ id: blobId, blob });
  return blobId;
}

export async function saveOfflineTrack(track, options = {}) {
  const normalizedTrackId = normalizeOfflineId(track?.id ?? track?.trackId);

  if (normalizedTrackId === null) {
    return null;
  }

  const database =
    options.trackStore && options.audioBlobStore && options.artworkBlobStore
      ? null
      : await getOfflineDatabase();

  if (!options.trackStore && !database) {
    return null;
  }

  const tx =
    options.trackStore && options.audioBlobStore && options.artworkBlobStore
      ? null
      : database.transaction(
          [
            OFFLINE_TRACKS_STORE,
            OFFLINE_AUDIO_BLOBS_STORE,
            OFFLINE_ARTWORK_BLOBS_STORE,
          ],
          "readwrite",
        );

  const trackStore = options.trackStore ?? tx.objectStore(OFFLINE_TRACKS_STORE);
  const audioBlobStore =
    options.audioBlobStore ?? tx.objectStore(OFFLINE_AUDIO_BLOBS_STORE);
  const artworkBlobStore =
    options.artworkBlobStore ?? tx.objectStore(OFFLINE_ARTWORK_BLOBS_STORE);

  try {
    const existingTrack =
      options.existingTrack ?? (await trackStore.get(normalizedTrackId));
    const playlistIds = normalizeOfflineIdList(
      track?.playlistIds ?? existingTrack?.playlistIds,
    );

    let audioBlobId = normalizeOfflineId(track?.audioBlobId);

    if (track?.audioBlob instanceof Blob) {
      audioBlobId = await saveOfflineAudioBlob(normalizedTrackId, track.audioBlob, {
        audioBlobStore,
      });
    } else if (audioBlobId === null) {
      audioBlobId = normalizeOfflineId(existingTrack?.audioBlobId);
    }

    if (audioBlobId === null) {
      if (tx) {
        await tx.done.catch(() => {});
      }

      return null;
    }

    let artworkBlobId = normalizeOfflineId(track?.artworkBlobId);

    if (track?.artworkBlob instanceof Blob) {
      artworkBlobId = await saveOfflineArtworkBlob(
        normalizedTrackId,
        track.artworkBlob,
        { artworkBlobStore },
      );
    } else if (artworkBlobId === null) {
      artworkBlobId = normalizeOfflineId(existingTrack?.artworkBlobId);
    }

    const record = {
      id: normalizedTrackId,
      title: normalizeText(track?.title, existingTrack?.title || "Unknown Title"),
      artist: normalizeText(track?.artist, existingTrack?.artist || ""),
      album: normalizeText(track?.album, existingTrack?.album || ""),
      duration:
        normalizeDuration(track?.duration) ?? normalizeDuration(existingTrack?.duration),
      playlistIds,
      audioBlobId,
      artworkBlobId,
      sizeBytes:
        getByteSize(track?.sizeBytes) ||
        getByteSize(track?.audioBlob?.size) ||
        getByteSize(existingTrack?.sizeBytes),
      downloadedAt:
        normalizeText(track?.downloadedAt, existingTrack?.downloadedAt || "") ||
        new Date().toISOString(),
    };

    await trackStore.put(record);

    if (tx) {
      await tx.done;
    }

    return record;
  } catch {
    if (tx) {
      await tx.done.catch(() => {});
    }

    return null;
  }
}

export async function saveDownloadedPlaylist(downloadPayload) {
  const normalizedPlaylistId = normalizeOfflineId(downloadPayload?.id);

  if (normalizedPlaylistId === null) {
    return null;
  }

  const database = await getOfflineDatabase();

  if (!database) {
    return null;
  }

  const requestedTracks = Array.isArray(downloadPayload?.tracks)
    ? downloadPayload.tracks
    : [];

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
    const { playlistStore, trackStore, audioBlobStore, artworkBlobStore } =
      getTransactionStores(tx);

    const existingPlaylist = await playlistStore.get(normalizedPlaylistId);
    const previousTrackIds = normalizeOfflineIdList(existingPlaylist?.trackIds);
    const savedTrackIds = [];
    let totalBytes = 0;

    for (const track of requestedTracks) {
      const savedTrack = await saveOfflineTrack(
        {
          ...track,
          id: track?.id ?? track?.trackId,
          playlistIds: [
            normalizedPlaylistId,
            ...normalizeOfflineIdList(track?.playlistIds),
          ],
          downloadedAt:
            normalizeText(track?.downloadedAt, downloadPayload?.downloadedAt || "") ||
            new Date().toISOString(),
        },
        {
          trackStore,
          audioBlobStore,
          artworkBlobStore,
        },
      );

      if (!savedTrack) {
        continue;
      }

      savedTrackIds.push(savedTrack.id);
      totalBytes += getByteSize(savedTrack.sizeBytes);
    }

    const retainedTrackIds = new Set(savedTrackIds);

    for (const previousTrackId of previousTrackIds) {
      if (retainedTrackIds.has(previousTrackId)) {
        continue;
      }

      const existingTrack = await trackStore.get(previousTrackId);

      if (!existingTrack) {
        continue;
      }

      const remainingPlaylistIds = normalizeOfflineIdList(
        existingTrack.playlistIds,
      ).filter((playlistId) => playlistId !== normalizedPlaylistId);

      if (remainingPlaylistIds.length > 0) {
        await trackStore.put({
          ...existingTrack,
          playlistIds: remainingPlaylistIds,
        });
      } else {
        await trackStore.delete(previousTrackId);
      }
    }

    const playlistRecord = {
      id: normalizedPlaylistId,
      name: normalizeText(downloadPayload?.name, existingPlaylist?.name || "Untitled playlist"),
      trackIds: savedTrackIds,
      downloadedAt:
        normalizeText(downloadPayload?.downloadedAt, existingPlaylist?.downloadedAt || "") ||
        new Date().toISOString(),
      totalTracks: savedTrackIds.length,
      totalBytes,
      requestedTrackCount:
        getByteSize(downloadPayload?.requestedTrackCount) || requestedTracks.length,
      failedTrackCount: getByteSize(downloadPayload?.failedTrackCount),
    };

    await playlistStore.put(playlistRecord);
    await cleanupUnreferencedBlobs({
      trackStore,
      audioBlobStore,
      artworkBlobStore,
    });
    await tx.done;

    return playlistRecord;
  } catch {
    return null;
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

    const playlistTrackIds = new Set(normalizeOfflineIdList(playlist.trackIds));

    await playlistStore.delete(normalizedPlaylistId);

    for (const trackId of playlistTrackIds) {
      const track = await trackStore.get(trackId);

      if (!track) {
        continue;
      }

      const remainingPlaylistIds = normalizeOfflineIdList(track.playlistIds).filter(
        (id) => id !== normalizedPlaylistId,
      );

      if (remainingPlaylistIds.length > 0) {
        await trackStore.put({
          ...track,
          playlistIds: remainingPlaylistIds,
        });
      } else {
        await trackStore.delete(track.id);
      }
    }

    await cleanupUnreferencedBlobs({
      trackStore,
      audioBlobStore,
      artworkBlobStore,
    });

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
