import {
  fetchAuthenticatedBlob,
  getTrackArtPath,
  getTrackStreamPath,
} from "../api/apiBase";
import { getDownloadedTrack, saveDownloadedPlaylist } from "./offlineStorage";
import {
  getOfflineTrack,
  saveNativeDownloadedPlaylist,
  shouldUseMobileOfflineSqlite,
} from "./mobileOfflineRepository";
import {
  deleteAudioFile,
  deleteArtworkFile,
  saveAudioFile,
  saveArtworkFile,
} from "./nativeMediaFileStorage";

function createAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("Offline download cancelled.", "AbortError");
  }

  const error = new Error("Offline download cancelled.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function normalizeTrackId(track) {
  return track?.track_id ?? track?.id ?? null;
}

function normalizeTrackForOffline(track) {
  const trackId = normalizeTrackId(track);

  return {
    id: trackId,
    title: typeof track?.title === "string" ? track.title : "Unknown Title",
    artist: typeof track?.artist === "string" ? track.artist : "",
    album: typeof track?.album === "string" ? track.album : "",
    duration: Number.isFinite(Number(track?.duration))
      ? Number(track.duration)
      : null,
    position: Number.isFinite(Number(track?.position)) ? Number(track.position) : null,
  };
}

function buildProgress({
  totalTracks,
  completedTracks,
  failedTracks,
  downloadedBytes,
  currentTrackTitle = "",
}) {
  return {
    totalTracks,
    completedTracks,
    failedTracks,
    processedTracks: completedTracks + failedTracks,
    downloadedBytes,
    currentTrackTitle,
  };
}

async function cleanupCreatedNativeFiles(trackIdsByKind) {
  const uniqueAudioTrackIds = [...new Set(trackIdsByKind.audio)];
  const uniqueArtworkTrackIds = [...new Set(trackIdsByKind.artwork)];

  await Promise.all([
    ...uniqueAudioTrackIds.map(async (trackId) => {
      try {
        await deleteAudioFile(trackId);
      } catch {}
    }),
    ...uniqueArtworkTrackIds.map(async (trackId) => {
      try {
        await deleteArtworkFile(trackId);
      } catch {}
    }),
  ]);
}

async function downloadPlaylistForBrowser({
  playlist,
  onProgress,
  signal,
}) {
  const orderedTracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const totalTracks = orderedTracks.length;
  const downloadedAt = new Date().toISOString();
  const successfulTracks = [];
  const failedTrackIds = [];
  let completedTracks = 0;
  let failedTracks = 0;
  let downloadedBytes = 0;

  onProgress?.(
    buildProgress({
      totalTracks,
      completedTracks,
      failedTracks,
      downloadedBytes,
    }),
  );

  for (const track of orderedTracks) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    const normalizedTrack = normalizeTrackForOffline(track);

    if (normalizedTrack.id === null) {
      failedTracks += 1;
      failedTrackIds.push(null);
      onProgress?.(
        buildProgress({
          totalTracks,
          completedTracks,
          failedTracks,
          downloadedBytes,
          currentTrackTitle: normalizedTrack.title,
        }),
      );
      continue;
    }

    const existingTrack = await getDownloadedTrack(normalizedTrack.id);
    const hasExistingAudio = Boolean(existingTrack?.audioBlobId);
    const hasExistingArtwork = Boolean(existingTrack?.artworkBlobId);

    let audioBlob = null;
    let artworkBlob = null;
    let sizeBytes = Number(existingTrack?.sizeBytes) || 0;

    if (!hasExistingAudio) {
      try {
        audioBlob = await fetchAuthenticatedBlob(
          getTrackStreamPath(normalizedTrack.id),
          { signal },
        );
        sizeBytes = audioBlob.size || sizeBytes;
        downloadedBytes += audioBlob.size || 0;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        failedTracks += 1;
        failedTrackIds.push(normalizedTrack.id);
        onProgress?.(
          buildProgress({
            totalTracks,
            completedTracks,
            failedTracks,
            downloadedBytes,
            currentTrackTitle: normalizedTrack.title,
          }),
        );
        continue;
      }
    }

    if (!hasExistingArtwork) {
      try {
        artworkBlob = await fetchAuthenticatedBlob(
          getTrackArtPath(normalizedTrack.id),
          { signal },
        );
        downloadedBytes += artworkBlob.size || 0;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
      }
    }

    successfulTracks.push({
      ...normalizedTrack,
      audioBlob,
      artworkBlob,
      sizeBytes,
      downloadedAt,
    });
    completedTracks += 1;

    onProgress?.(
      buildProgress({
        totalTracks,
        completedTracks,
        failedTracks,
        downloadedBytes,
        currentTrackTitle: normalizedTrack.title,
      }),
    );
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  if (successfulTracks.length === 0) {
    return {
      totalTracks,
      completedTracks: 0,
      failedTracks,
      downloadedBytes,
      failedTrackIds,
      savedPlaylist: null,
    };
  }

  const savedPlaylist = await saveDownloadedPlaylist({
    id: playlist?.id,
    name: playlist?.name,
    tracks: successfulTracks,
    downloadedAt,
    requestedTrackCount: totalTracks,
    failedTrackCount: failedTracks,
  });

  return {
    totalTracks,
    completedTracks: successfulTracks.length,
    failedTracks,
    downloadedBytes,
    failedTrackIds,
    savedPlaylist,
  };
}

async function downloadPlaylistForNativeAndroid({
  playlist,
  onProgress,
  signal,
}) {
  const orderedTracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const totalTracks = orderedTracks.length;
  const downloadedAt = new Date().toISOString();
  const successfulTracks = [];
  const failedTrackIds = [];
  const createdNativeFiles = {
    audio: [],
    artwork: [],
  };
  let completedTracks = 0;
  let failedTracks = 0;
  let downloadedBytes = 0;

  onProgress?.(
    buildProgress({
      totalTracks,
      completedTracks,
      failedTracks,
      downloadedBytes,
    }),
  );

  for (const track of orderedTracks) {
    if (signal?.aborted) {
      await cleanupCreatedNativeFiles(createdNativeFiles);
      throw createAbortError();
    }

    const normalizedTrack = normalizeTrackForOffline(track);

    if (normalizedTrack.id === null) {
      failedTracks += 1;
      failedTrackIds.push(null);
      onProgress?.(
        buildProgress({
          totalTracks,
          completedTracks,
          failedTracks,
          downloadedBytes,
          currentTrackTitle: normalizedTrack.title,
        }),
      );
      continue;
    }

    const existingTrack = await getOfflineTrack(normalizedTrack.id);
    const hasExistingAudio = Boolean(existingTrack?.audioLocalUri);
    const hasExistingArtwork = Boolean(existingTrack?.artworkLocalUri);

    let audioLocalUri = existingTrack?.audioLocalUri ?? null;
    let artworkLocalUri = existingTrack?.artworkLocalUri ?? null;
    let sizeBytes = 0;

    if (!hasExistingAudio) {
      try {
        const audioBlob = await fetchAuthenticatedBlob(
          getTrackStreamPath(normalizedTrack.id),
          { signal },
        );
        sizeBytes = audioBlob.size || 0;
        downloadedBytes += audioBlob.size || 0;

        const savedAudioFile = await saveAudioFile(
          normalizedTrack.id,
          audioBlob,
          audioBlob.type,
        );
        audioLocalUri = savedAudioFile?.relativePath ?? null;

        if (!audioLocalUri) {
          throw new Error("Audio file was not saved to native storage.");
        }

        createdNativeFiles.audio.push(normalizedTrack.id);
      } catch (error) {
        if (isAbortError(error)) {
          await cleanupCreatedNativeFiles(createdNativeFiles);
          throw error;
        }

        failedTracks += 1;
        failedTrackIds.push(normalizedTrack.id);
        onProgress?.(
          buildProgress({
            totalTracks,
            completedTracks,
            failedTracks,
            downloadedBytes,
            currentTrackTitle: normalizedTrack.title,
          }),
        );
        continue;
      }
    }

    if (hasExistingAudio) {
      sizeBytes = 0;
    }

    if (!hasExistingArtwork) {
      try {
        const artworkBlob = await fetchAuthenticatedBlob(
          getTrackArtPath(normalizedTrack.id),
          { signal },
        );
        downloadedBytes += artworkBlob.size || 0;

        const savedArtworkFile = await saveArtworkFile(
          normalizedTrack.id,
          artworkBlob,
          artworkBlob.type,
        );
        artworkLocalUri = savedArtworkFile?.relativePath ?? null;

        if (artworkLocalUri) {
          createdNativeFiles.artwork.push(normalizedTrack.id);
        }
      } catch (error) {
        if (isAbortError(error)) {
          await cleanupCreatedNativeFiles(createdNativeFiles);
          throw error;
        }
      }
    }

    successfulTracks.push({
      ...normalizedTrack,
      audioLocalUri,
      artworkLocalUri,
      sizeBytes,
      downloadedAt,
      storageType: "native_file",
    });
    completedTracks += 1;

    onProgress?.(
      buildProgress({
        totalTracks,
        completedTracks,
        failedTracks,
        downloadedBytes,
        currentTrackTitle: normalizedTrack.title,
      }),
    );
  }

  if (signal?.aborted) {
    await cleanupCreatedNativeFiles(createdNativeFiles);
    throw createAbortError();
  }

  if (successfulTracks.length === 0) {
    return {
      totalTracks,
      completedTracks: 0,
      failedTracks,
      downloadedBytes,
      failedTrackIds,
      savedPlaylist: null,
    };
  }

  const savedPlaylist = await saveNativeDownloadedPlaylist({
    id: playlist?.id,
    name: playlist?.name,
    tracks: successfulTracks,
    downloadedAt,
    requestedTrackCount: totalTracks,
    failedTrackCount: failedTracks,
  });

  if (!savedPlaylist) {
    await cleanupCreatedNativeFiles(createdNativeFiles);
    throw new Error("Could not save native offline playlist metadata.");
  }

  return {
    totalTracks,
    completedTracks: successfulTracks.length,
    failedTracks,
    downloadedBytes,
    failedTrackIds,
    savedPlaylist,
  };
}

export async function downloadPlaylistForOffline({
  playlist,
  onProgress,
  signal,
}) {
  return shouldUseMobileOfflineSqlite()
    ? downloadPlaylistForNativeAndroid({ playlist, onProgress, signal })
    : downloadPlaylistForBrowser({ playlist, onProgress, signal });
}
