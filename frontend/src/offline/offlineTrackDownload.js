import {
  fetchAuthenticatedBlob,
  getTrackArtPath,
  getTrackStreamPath,
} from "../api/apiBase";
import {
  getDownloadedTrack,
  hasVerifiedDownloadedTrack,
} from "./offlineStorage";
import {
  getOfflineTrack,
  shouldUseMobileOfflineSqlite,
} from "./mobileOfflineRepository";
import {
  deleteAudioFile,
  deleteArtworkFile,
  getNativeMediaFileSize,
  saveAudioFile,
  saveArtworkFile,
} from "./nativeMediaFileStorage";

export function createAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("Offline download cancelled.", "AbortError");
  }

  const error = new Error("Offline download cancelled.");
  error.name = "AbortError";
  return error;
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}

export function normalizeTrackId(track) {
  return track?.track_id ?? track?.id ?? null;
}

export function normalizeTrackForOffline(track) {
  const trackId = normalizeTrackId(track);

  return {
    id: trackId,
    title: typeof track?.title === "string" ? track.title : "Unknown Title",
    artist: typeof track?.artist === "string" ? track.artist : "",
    album: typeof track?.album === "string" ? track.album : "",
    duration: Number.isFinite(Number(track?.duration))
      ? Number(track.duration)
      : null,
    position: Number.isFinite(Number(track?.position))
      ? Number(track.position)
      : null,
  };
}

function yieldForNativeMemoryRelief() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function hasVerifiedNativeAudio(trackId) {
  const track = await getOfflineTrack(trackId);

  if (typeof track?.audioLocalUri !== "string" || !track.audioLocalUri.trim()) {
    return {
      verified: false,
      existingTrack: track,
      sizeBytes: 0,
    };
  }

  const sizeBytes = Number(await getNativeMediaFileSize(track.audioLocalUri.trim())) || 0;

  return {
    verified: sizeBytes > 0,
    existingTrack: track,
    sizeBytes,
  };
}

async function getExistingOfflineTrackState(trackId) {
  if (shouldUseMobileOfflineSqlite()) {
    return hasVerifiedNativeAudio(trackId);
  }

  const existingTrack = await getDownloadedTrack(trackId);
  const verified = await hasVerifiedDownloadedTrack(trackId);

  return {
    verified,
    existingTrack,
    sizeBytes: verified ? Number(existingTrack?.sizeBytes) || 0 : 0,
  };
}

export async function cleanupCreatedNativeFiles(trackIdsByKind) {
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

function getFetchOptions(signal, abortDuringTrack) {
  return abortDuringTrack ? { signal } : {};
}

export async function downloadTrackForOffline(
  track,
  {
    downloadedAt = new Date().toISOString(),
    signal,
    abortDuringTrack = true,
    existingTrackState = null,
  } = {},
) {
  if (signal?.aborted) {
    throw createAbortError();
  }

  const normalizedTrack = normalizeTrackForOffline(track);

  if (normalizedTrack.id === null) {
    return {
      status: "failed",
      trackId: null,
      title: normalizedTrack.title,
      downloadedBytes: 0,
      failureReason: "missing_track_id",
    };
  }

  const {
    verified,
    existingTrack,
    sizeBytes: existingSizeBytes,
  } = existingTrackState ?? (await getExistingOfflineTrackState(normalizedTrack.id));
  const hasExistingArtwork = shouldUseMobileOfflineSqlite()
    ? Boolean(existingTrack?.artworkLocalUri)
    : Boolean(existingTrack?.artworkBlobId);

  if (verified) {
    return {
      status: "existing",
      trackId: normalizedTrack.id,
      title: normalizedTrack.title,
      downloadedBytes: 0,
      sizeBytes: existingSizeBytes,
      downloadedTrack: {
        ...normalizedTrack,
        downloadedAt,
        storageType: shouldUseMobileOfflineSqlite()
          ? "native_file"
          : "indexeddb_blob",
        audioLocalUri: shouldUseMobileOfflineSqlite()
          ? existingTrack?.audioLocalUri ?? null
          : null,
        artworkLocalUri: shouldUseMobileOfflineSqlite()
          ? existingTrack?.artworkLocalUri ?? null
          : null,
        audioBlobId: shouldUseMobileOfflineSqlite()
          ? null
          : existingTrack?.audioBlobId ?? null,
        artworkBlobId: shouldUseMobileOfflineSqlite()
          ? null
          : existingTrack?.artworkBlobId ?? null,
        sizeBytes: existingSizeBytes,
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    };
  }

  let audioBlob = null;
  let artworkBlob = null;
  let audioLocalUri = shouldUseMobileOfflineSqlite()
    ? existingTrack?.audioLocalUri ?? null
    : null;
  let artworkLocalUri = shouldUseMobileOfflineSqlite()
    ? existingTrack?.artworkLocalUri ?? null
    : null;
  let sizeBytes = 0;
  let downloadedBytes = 0;
  let createdNativeAudio = false;
  let createdNativeArtwork = false;

  try {
    audioBlob = await fetchAuthenticatedBlob(
      getTrackStreamPath(normalizedTrack.id),
      getFetchOptions(signal, abortDuringTrack),
    );
    sizeBytes = audioBlob.size || 0;
    downloadedBytes += sizeBytes;

    if (shouldUseMobileOfflineSqlite()) {
      const savedAudioFile = await saveAudioFile(
        normalizedTrack.id,
        audioBlob,
        audioBlob.type,
      );
      audioLocalUri = savedAudioFile?.relativePath ?? null;

      if (!audioLocalUri) {
        throw new Error("Audio file was not saved to native storage.");
      }

      createdNativeAudio = true;
      audioBlob = null;
      await yieldForNativeMemoryRelief();
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return {
      status: "failed",
      trackId: normalizedTrack.id,
      title: normalizedTrack.title,
      downloadedBytes,
      failureReason: "audio_download_failed",
    };
  }

  if (!hasExistingArtwork) {
    try {
      artworkBlob = await fetchAuthenticatedBlob(
        getTrackArtPath(normalizedTrack.id),
        getFetchOptions(signal, abortDuringTrack),
      );
      downloadedBytes += artworkBlob.size || 0;

      if (shouldUseMobileOfflineSqlite()) {
        const savedArtworkFile = await saveArtworkFile(
          normalizedTrack.id,
          artworkBlob,
          artworkBlob.type,
        );
        artworkLocalUri = savedArtworkFile?.relativePath ?? null;

        if (artworkLocalUri) {
          createdNativeArtwork = true;
        }

        artworkBlob = null;
        await yieldForNativeMemoryRelief();
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
    }
  }

  return {
    status: "downloaded",
    trackId: normalizedTrack.id,
    title: normalizedTrack.title,
    downloadedBytes,
    sizeBytes,
    downloadedTrack: {
      ...normalizedTrack,
      downloadedAt,
      sizeBytes,
      storageType: shouldUseMobileOfflineSqlite() ? "native_file" : "indexeddb_blob",
      audioBlob,
      artworkBlob,
      audioLocalUri,
      artworkLocalUri,
      audioBlobId: null,
      artworkBlobId: null,
    },
    createdNativeFiles: {
      audio: createdNativeAudio,
      artwork: createdNativeArtwork,
    },
  };
}
