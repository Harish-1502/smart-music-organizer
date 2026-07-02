import { getAppMode, isLanMode } from "../../../appMode/appMode";
import { backendLibrarySource } from "../../library/sources/backendLibrarySource";
import {
  formatSafeError,
  getSafeErrorMessage,
} from "../../../utils/formatSafeError";
import {
  ensureMobileOfflineDbReady,
  getBulkOfflineTrackVerification,
  OfflineDatabaseUnavailableError,
  saveOfflineTrackWithMediaRefs,
  shouldUseMobileOfflineSqlite,
} from "../storage/mobileOfflineRepository";
import { saveOfflineTrack } from "../storage/offlineStorage";
import {
  cleanupCreatedNativeFiles,
  downloadTrackForOffline,
  isAbortError,
} from "./offlineTrackDownload";

let activeFullLibraryDownloadPromise = null;
let activeFullLibraryDownloadAbortController = null;
let fullLibraryDownloadRuntimeState = {
  isRunning: false,
  progress: null,
  lastResult: null,
};
const fullLibraryDownloadSubscribers = new Set();

function normalizeTrackId(track) {
  return track?.track_id ?? track?.id ?? null;
}

function buildLibraryProgress({
  totalLibraryTracks,
  totalMissingTracks,
  processedMissingTracks,
  verifiedExistingCount,
  downloadedCount,
  skippedCount,
  failedCount,
  downloadedBytes,
  currentTrackTitle = "",
  lastSafeErrorMessage = "",
}) {
  return {
    totalLibraryTracks,
    totalMissingTracks,
    processedMissingTracks,
    verifiedExistingCount,
    downloadedCount,
    skippedCount,
    failedCount,
    downloadedBytes,
    currentTrackTitle,
    lastSafeErrorMessage,
  };
}

function createEmptyLibraryProgress() {
  return buildLibraryProgress({
    totalLibraryTracks: 0,
    totalMissingTracks: 0,
    processedMissingTracks: 0,
    verifiedExistingCount: 0,
    downloadedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    downloadedBytes: 0,
    currentTrackTitle: "",
    lastSafeErrorMessage: "",
  });
}

function createLibraryDownloadResult(overrides = {}) {
  return {
    blocked: false,
    blockedByMode: false,
    error: null,
    cancelled: false,
    totalLibraryTracks: 0,
    totalMissingTracks: 0,
    verifiedExistingCount: 0,
    downloadedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    downloadedBytes: 0,
    lastSafeErrorMessage: "",
    ...overrides,
  };
}

function emitFullLibraryDownloadRuntimeState() {
  const snapshot = getFullLibraryDownloadRuntimeState();

  for (const subscriber of fullLibraryDownloadSubscribers) {
    try {
      subscriber(snapshot);
    } catch {}
  }
}

function setFullLibraryDownloadRuntimeState(nextState) {
  fullLibraryDownloadRuntimeState = {
    ...fullLibraryDownloadRuntimeState,
    ...nextState,
  };
  emitFullLibraryDownloadRuntimeState();
}

export function getFullLibraryDownloadRuntimeState() {
  return {
    isRunning: Boolean(fullLibraryDownloadRuntimeState.isRunning),
    progress: fullLibraryDownloadRuntimeState.progress
      ? { ...fullLibraryDownloadRuntimeState.progress }
      : createEmptyLibraryProgress(),
    lastResult: fullLibraryDownloadRuntimeState.lastResult
      ? { ...fullLibraryDownloadRuntimeState.lastResult }
      : null,
  };
}

export function subscribeToFullLibraryDownloadState(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  fullLibraryDownloadSubscribers.add(listener);
  listener(getFullLibraryDownloadRuntimeState());

  return () => {
    fullLibraryDownloadSubscribers.delete(listener);
  };
}

export function cancelFullLibraryDownload() {
  activeFullLibraryDownloadAbortController?.abort();
}

function sanitizeSafeErrorMessage(
  error,
  fallback = "A track could not be downloaded.",
) {
  return getSafeErrorMessage(error, fallback);
}

function logFullLibraryError(operation, error, track = null) {
  console.error(
    `[full-library-download:error] ${JSON.stringify(
      {
        operation,
        trackId:
          track?.id ??
          track?.track_id ??
          track?.trackId ??
          error?.trackId ??
          null,
        trackTitle:
          typeof (track?.title ?? error?.trackTitle) === "string"
            ? (track?.title ?? error?.trackTitle)
            : "",
        error: formatSafeError(error),
      },
      null,
      2,
    )}`,
  );
}

function logFullLibraryPhase(phase, details = {}) {
  console.info(
    `[full-library-download:${phase}] ${JSON.stringify(details, null, 2)}`,
  );
}

function createOfflineDatabaseUnavailableMessage() {
  return "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.";
}

function yieldForFullLibraryMemoryRelief() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function loadBackendLibraryTracks() {
  const result = await backendLibrarySource.getAllTracks({
    sortBy: "title",
    order: "asc",
    pageSize: 100,
  });

  return Array.isArray(result?.items) ? result.items : [];
}

async function buildFullLibraryDownloadPlan({
  mode = getAppMode(),
  includeTracks = false,
} = {}) {
  if (!isLanMode(mode)) {
    return {
      available: false,
      blockedByMode: true,
      totalLibraryTracks: 0,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      brokenLocalRefCount: 0,
      estimatedSizeAvailable: false,
      tracks: includeTracks ? [] : undefined,
      missingTracks: includeTracks ? [] : undefined,
      verificationMap: new Map(),
      error: null,
      lastSafeErrorMessage: "",
    };
  }

  let tracks = [];

  try {
    logFullLibraryPhase("fetching-library", { mode });
    tracks = await loadBackendLibraryTracks();
    logFullLibraryPhase("fetching-library", {
      mode,
      trackCount: tracks.length,
    });
  } catch (error) {
    logFullLibraryError("fetching-library", error);
    return {
      available: false,
      blockedByMode: false,
      totalLibraryTracks: 0,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      brokenLocalRefCount: 0,
      estimatedSizeAvailable: false,
      tracks: includeTracks ? [] : undefined,
      missingTracks: includeTracks ? [] : undefined,
      verificationMap: includeTracks ? new Map() : undefined,
      error: "library_unavailable",
      lastSafeErrorMessage:
        "Could not load your PC library for offline download.",
    };
  }

  if (tracks.length === 0) {
    return {
      available: true,
      blockedByMode: false,
      totalLibraryTracks: 0,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      brokenLocalRefCount: 0,
      estimatedSizeAvailable: false,
      tracks: includeTracks ? [] : undefined,
      missingTracks: includeTracks ? [] : undefined,
      verificationMap: includeTracks ? new Map() : undefined,
      error: null,
      lastSafeErrorMessage: "",
    };
  }

  if (shouldUseMobileOfflineSqlite()) {
    try {
      logFullLibraryPhase("ensuring-offline-db", {
        mode,
        trackCount: tracks.length,
      });
      const database = await ensureMobileOfflineDbReady();

      if (!database) {
        throw new OfflineDatabaseUnavailableError();
      }

      logFullLibraryPhase("ensuring-offline-db", {
        mode,
        dbReady: true,
      });
    } catch (error) {
      logFullLibraryError("ensuring-offline-db", error);
      return {
        available: false,
        blockedByMode: false,
        totalLibraryTracks: tracks.length,
        alreadyDownloadedCount: 0,
        missingDownloadCount: 0,
        brokenLocalRefCount: 0,
        estimatedSizeAvailable: false,
        tracks: includeTracks ? tracks : undefined,
        missingTracks: includeTracks ? [] : undefined,
        verificationMap: includeTracks ? new Map() : undefined,
        error: "offline_database_unavailable",
        lastSafeErrorMessage:
          error instanceof OfflineDatabaseUnavailableError
            ? createOfflineDatabaseUnavailableMessage()
            : sanitizeSafeErrorMessage(
                error,
                createOfflineDatabaseUnavailableMessage(),
              ),
      };
    }
  }

  const trackIds = tracks
    .map((track) => normalizeTrackId(track))
    .filter((trackId) => trackId !== null);
  let verificationMap;

  try {
    logFullLibraryPhase("verifying-existing-downloads", {
      trackCount: trackIds.length,
    });
    verificationMap = await getBulkOfflineTrackVerification(trackIds);
  } catch (error) {
    logFullLibraryError("verifying-existing-downloads", error);
    return {
      available: false,
      blockedByMode: false,
      totalLibraryTracks: tracks.length,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      brokenLocalRefCount: 0,
      estimatedSizeAvailable: false,
      tracks: includeTracks ? tracks : undefined,
      missingTracks: includeTracks ? [] : undefined,
      verificationMap: includeTracks ? new Map() : undefined,
      error: "offline_database_unavailable",
      lastSafeErrorMessage:
        error instanceof OfflineDatabaseUnavailableError
          ? createOfflineDatabaseUnavailableMessage()
          : sanitizeSafeErrorMessage(
              error,
              createOfflineDatabaseUnavailableMessage(),
            ),
    };
  }

  let alreadyDownloadedCount = 0;
  let brokenLocalRefCount = 0;
  const missingTracks = [];

  for (const track of tracks) {
    const trackId = normalizeTrackId(track);

    if (!trackId) {
      continue;
    }

    const verification = verificationMap.get(trackId);

    if (verification?.verified) {
      alreadyDownloadedCount += 1;
      continue;
    }

    if (verification?.hasTrackRow || verification?.hasAudioRef) {
      brokenLocalRefCount += 1;
    }

    missingTracks.push(track);
  }

  return {
    available: true,
    blockedByMode: false,
    totalLibraryTracks: tracks.length,
    alreadyDownloadedCount,
    missingDownloadCount: missingTracks.length,
    brokenLocalRefCount,
    estimatedSizeAvailable: false,
    tracks: includeTracks ? tracks : undefined,
    missingTracks: includeTracks ? missingTracks : undefined,
    verificationMap: includeTracks ? verificationMap : undefined,
    error: null,
    lastSafeErrorMessage: "",
  };
}

export async function getFullLibraryDownloadStatus({
  mode = getAppMode(),
  includeTracks = false,
} = {}) {
  try {
    return await buildFullLibraryDownloadPlan({ mode, includeTracks });
  } catch (error) {
    logFullLibraryError("planning-library-download", error);
    return {
      available: false,
      blockedByMode: false,
      totalLibraryTracks: 0,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      brokenLocalRefCount: 0,
      estimatedSizeAvailable: false,
      tracks: includeTracks ? [] : undefined,
      missingTracks: includeTracks ? [] : undefined,
      verificationMap: includeTracks ? new Map() : undefined,
      error: "library_unavailable",
      lastSafeErrorMessage:
        "Could not load your PC library for offline download.",
    };
  }
}

async function persistNativeLibraryTrack(downloadedTrack, createdNativeFiles) {
  try {
    const database = await ensureMobileOfflineDbReady();

    if (!database) {
      throw new OfflineDatabaseUnavailableError();
    }

    const savedTrack = await saveOfflineTrackWithMediaRefs({
      id: downloadedTrack.id,
      title: downloadedTrack.title,
      artist: downloadedTrack.artist,
      album: downloadedTrack.album,
      duration: downloadedTrack.duration,
      downloadStatus: "downloaded",
      storageType: "native_file",
      downloadedAt: downloadedTrack.downloadedAt,
      audioLocalUri: downloadedTrack.audioLocalUri,
      artworkLocalUri: downloadedTrack.artworkLocalUri,
    });

    if (!savedTrack) {
      if (createdNativeFiles.audio || createdNativeFiles.artwork) {
        await cleanupCreatedNativeFiles({
          audio: createdNativeFiles.audio ? [downloadedTrack.id] : [],
          artwork: createdNativeFiles.artwork ? [downloadedTrack.id] : [],
        });
      }
      return {
        persisted: false,
        errorMessage: "Offline metadata could not be saved for one track.",
      };
    }

    return {
      persisted: true,
      errorMessage: "",
    };
  } catch (error) {
    logFullLibraryError("saving-track-metadata", error, downloadedTrack);
    if (createdNativeFiles.audio || createdNativeFiles.artwork) {
      await cleanupCreatedNativeFiles({
        audio: createdNativeFiles.audio ? [downloadedTrack.id] : [],
        artwork: createdNativeFiles.artwork ? [downloadedTrack.id] : [],
      });
    }
    return {
      persisted: false,
      errorMessage: sanitizeSafeErrorMessage(
        error,
        "Offline metadata could not be saved for one track.",
      ),
    };
  }
}

async function persistBrowserLibraryTrack(downloadedTrack) {
  const savedTrack = await saveOfflineTrack({
    id: downloadedTrack.id,
    title: downloadedTrack.title,
    artist: downloadedTrack.artist,
    album: downloadedTrack.album,
    duration: downloadedTrack.duration,
    audioBlob: downloadedTrack.audioBlob,
    artworkBlob: downloadedTrack.artworkBlob,
    sizeBytes: downloadedTrack.sizeBytes,
    downloadedAt: downloadedTrack.downloadedAt,
  });

  return Boolean(savedTrack);
}

export async function downloadFullLibraryForOffline({
  mode = getAppMode(),
  onProgress,
  signal,
} = {}) {
  if (activeFullLibraryDownloadPromise) {
    onProgress?.(getFullLibraryDownloadRuntimeState().progress);
    return activeFullLibraryDownloadPromise;
  }

  const effectiveSignal =
    signal ??
    (() => {
      activeFullLibraryDownloadAbortController = new AbortController();
      return activeFullLibraryDownloadAbortController.signal;
    })();

  if (effectiveSignal?.aborted) {
    return createLibraryDownloadResult({
      cancelled: true,
    });
  }

  const initialProgress = createEmptyLibraryProgress();
  setFullLibraryDownloadRuntimeState({
    isRunning: true,
    progress: initialProgress,
    lastResult: null,
  });
  onProgress?.(initialProgress);

  activeFullLibraryDownloadPromise = (async () => {
    if (!isLanMode(mode)) {
      return createLibraryDownloadResult({
        blocked: true,
        blockedByMode: true,
      });
    }

    const libraryStatus = await getFullLibraryDownloadStatus({
      mode,
      includeTracks: true,
    });

    if (libraryStatus.blockedByMode) {
      return createLibraryDownloadResult({
        blocked: true,
        blockedByMode: true,
      });
    }

    if (!libraryStatus.available) {
      return createLibraryDownloadResult({
        error: libraryStatus.error ?? "library_unavailable",
        totalLibraryTracks: libraryStatus.totalLibraryTracks ?? 0,
        lastSafeErrorMessage: libraryStatus.lastSafeErrorMessage ?? "",
      });
    }

    const allTracks = Array.isArray(libraryStatus.tracks)
      ? libraryStatus.tracks
      : [];
    const missingTracks = Array.isArray(libraryStatus.missingTracks)
      ? libraryStatus.missingTracks
      : [];
    const verificationMap =
      libraryStatus.verificationMap instanceof Map
        ? libraryStatus.verificationMap
        : new Map();

    let processedMissingTracks = 0;
    let verifiedExistingCount = libraryStatus.alreadyDownloadedCount;
    let downloadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let downloadedBytes = 0;
    let lastSafeErrorMessage = "";

    const reportProgress = (progress) => {
      setFullLibraryDownloadRuntimeState({
        isRunning: true,
        progress,
      });
      onProgress?.(progress);
    };

    reportProgress(
      buildLibraryProgress({
        totalLibraryTracks: allTracks.length,
        totalMissingTracks: missingTracks.length,
        processedMissingTracks,
        verifiedExistingCount,
        downloadedCount,
        skippedCount,
        failedCount,
        downloadedBytes,
        lastSafeErrorMessage,
      }),
    );

    for (const track of missingTracks) {
      if (effectiveSignal?.aborted) {
        return createLibraryDownloadResult({
          cancelled: true,
          totalLibraryTracks: allTracks.length,
          totalMissingTracks: missingTracks.length,
          verifiedExistingCount,
          downloadedCount,
          skippedCount,
          failedCount,
          downloadedBytes,
          lastSafeErrorMessage,
        });
      }

      let result;

      try {
        logFullLibraryPhase("downloading-track", {
          trackId: normalizeTrackId(track),
          trackTitle: track?.title ?? "",
        });
        result = await downloadTrackForOffline(track, {
          downloadedAt: new Date().toISOString(),
          signal: effectiveSignal,
          abortDuringTrack: false,
          existingTrackState: verificationMap.get(normalizeTrackId(track)) ?? {
            verified: false,
            existingTrack: null,
            sizeBytes: 0,
          },
        });
      } catch (error) {
        if (isAbortError(error)) {
          return createLibraryDownloadResult({
            cancelled: true,
            totalLibraryTracks: allTracks.length,
            totalMissingTracks: missingTracks.length,
            verifiedExistingCount,
            downloadedCount,
            skippedCount,
            failedCount,
            downloadedBytes,
            lastSafeErrorMessage,
          });
        }

        logFullLibraryError("verifying-existing-download", error, track);
        processedMissingTracks += 1;
        failedCount += 1;
        lastSafeErrorMessage = sanitizeSafeErrorMessage(error);
        reportProgress(
          buildLibraryProgress({
            totalLibraryTracks: allTracks.length,
            totalMissingTracks: missingTracks.length,
            processedMissingTracks,
            verifiedExistingCount,
            downloadedCount,
            skippedCount,
            failedCount,
            downloadedBytes,
            currentTrackTitle: track?.title ?? "",
            lastSafeErrorMessage,
          }),
        );
        if (shouldUseMobileOfflineSqlite()) {
          await yieldForFullLibraryMemoryRelief();
        }
        continue;
      }

      processedMissingTracks += 1;

      if (result.status === "failed") {
        failedCount += 1;
        lastSafeErrorMessage = "Audio download failed for one track.";
        reportProgress(
          buildLibraryProgress({
            totalLibraryTracks: allTracks.length,
            totalMissingTracks: missingTracks.length,
            processedMissingTracks,
            verifiedExistingCount,
            downloadedCount,
            skippedCount,
            failedCount,
            downloadedBytes,
            currentTrackTitle: result.title,
            lastSafeErrorMessage,
          }),
        );
        if (shouldUseMobileOfflineSqlite()) {
          await yieldForFullLibraryMemoryRelief();
        }
        continue;
      }

      if (result.status === "existing") {
        skippedCount += 1;
        reportProgress(
          buildLibraryProgress({
            totalLibraryTracks: allTracks.length,
            totalMissingTracks: missingTracks.length,
            processedMissingTracks,
            verifiedExistingCount,
            downloadedCount,
            skippedCount,
            failedCount,
            downloadedBytes,
            currentTrackTitle: result.title,
            lastSafeErrorMessage,
          }),
        );
        if (shouldUseMobileOfflineSqlite()) {
          await yieldForFullLibraryMemoryRelief();
        }
        continue;
      }

      const persistResult = shouldUseMobileOfflineSqlite()
        ? await persistNativeLibraryTrack(
            result.downloadedTrack,
            result.createdNativeFiles,
          )
        : {
            persisted: await persistBrowserLibraryTrack(result.downloadedTrack),
            errorMessage: "",
          };

      if (!persistResult.persisted) {
        failedCount += 1;
        lastSafeErrorMessage =
          persistResult.errorMessage ||
          "Offline metadata could not be saved for one track.";
      } else {
        downloadedCount += 1;
        downloadedBytes += result.downloadedBytes || 0;
      }

      reportProgress(
        buildLibraryProgress({
          totalLibraryTracks: allTracks.length,
          totalMissingTracks: missingTracks.length,
          processedMissingTracks,
          verifiedExistingCount,
          downloadedCount,
          skippedCount,
          failedCount,
          downloadedBytes,
          currentTrackTitle: result.title,
          lastSafeErrorMessage,
        }),
      );
      if (shouldUseMobileOfflineSqlite()) {
        await yieldForFullLibraryMemoryRelief();
      }
    }

    return createLibraryDownloadResult({
      totalLibraryTracks: allTracks.length,
      totalMissingTracks: missingTracks.length,
      verifiedExistingCount,
      downloadedCount,
      skippedCount,
      failedCount,
      downloadedBytes,
      lastSafeErrorMessage,
    });
  })();

  try {
    const result = await activeFullLibraryDownloadPromise;
    setFullLibraryDownloadRuntimeState({
      isRunning: false,
      progress: createEmptyLibraryProgress(),
      lastResult: result,
    });
    return result;
  } finally {
    activeFullLibraryDownloadPromise = null;
    activeFullLibraryDownloadAbortController = null;
  }
}
