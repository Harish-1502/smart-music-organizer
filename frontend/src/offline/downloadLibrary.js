import { getAppMode, isLanMode } from "../appMode/appMode";
import { backendLibrarySource } from "../library/backendLibrarySource";
import {
  hasVerifiedOfflineTrack,
  saveOfflineMediaFileRef,
  saveOfflineTrackMetadata,
  shouldUseMobileOfflineSqlite,
} from "./mobileOfflineRepository";
import { saveOfflineTrack } from "./offlineStorage";
import {
  cleanupCreatedNativeFiles,
  downloadTrackForOffline,
} from "./offlineTrackDownload";

function normalizeTrackId(track) {
  return track?.track_id ?? track?.id ?? null;
}

function buildLibraryProgress({
  totalLibraryTracks,
  totalMissingTracks,
  processedMissingTracks,
  downloadedCount,
  skippedCount,
  failedCount,
  downloadedBytes,
  currentTrackTitle = "",
}) {
  return {
    totalLibraryTracks,
    totalMissingTracks,
    processedMissingTracks,
    downloadedCount,
    skippedCount,
    failedCount,
    downloadedBytes,
    currentTrackTitle,
  };
}

async function loadBackendLibraryTracks() {
  const result = await backendLibrarySource.getAllTracks({
    sortBy: "title",
    order: "asc",
    pageSize: 100,
  });

  return Array.isArray(result?.items) ? result.items : [];
}

export async function getFullLibraryDownloadStatus({
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
      estimatedSizeAvailable: false,
      tracks: includeTracks ? [] : undefined,
    };
  }

  try {
    const tracks = await loadBackendLibraryTracks();
    let alreadyDownloadedCount = 0;

    for (const track of tracks) {
      const trackId = normalizeTrackId(track);

      if (!trackId) {
        continue;
      }

      if (await hasVerifiedOfflineTrack(trackId)) {
        alreadyDownloadedCount += 1;
      }
    }

    return {
      available: true,
      blockedByMode: false,
      totalLibraryTracks: tracks.length,
      alreadyDownloadedCount,
      missingDownloadCount: Math.max(0, tracks.length - alreadyDownloadedCount),
      estimatedSizeAvailable: false,
      tracks: includeTracks ? tracks : undefined,
    };
  } catch {
    return {
      available: false,
      blockedByMode: false,
      totalLibraryTracks: 0,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      estimatedSizeAvailable: false,
      tracks: includeTracks ? [] : undefined,
    };
  }
}

async function persistNativeLibraryTrack(downloadedTrack, createdNativeFiles) {
  const savedTrack = await saveOfflineTrackMetadata({
    id: downloadedTrack.id,
    title: downloadedTrack.title,
    artist: downloadedTrack.artist,
    album: downloadedTrack.album,
    duration: downloadedTrack.duration,
    downloadStatus: "downloaded",
    storageType: "native_file",
    downloadedAt: downloadedTrack.downloadedAt,
  });

  if (!savedTrack) {
    if (createdNativeFiles.audio || createdNativeFiles.artwork) {
      await cleanupCreatedNativeFiles({
        audio: createdNativeFiles.audio ? [downloadedTrack.id] : [],
        artwork: createdNativeFiles.artwork ? [downloadedTrack.id] : [],
      });
    }
    return false;
  }

  const savedAudioRef = await saveOfflineMediaFileRef(
    downloadedTrack.id,
    "audio",
    downloadedTrack.audioLocalUri,
  );

  if (!savedAudioRef) {
    if (createdNativeFiles.audio || createdNativeFiles.artwork) {
      await cleanupCreatedNativeFiles({
        audio: createdNativeFiles.audio ? [downloadedTrack.id] : [],
        artwork: createdNativeFiles.artwork ? [downloadedTrack.id] : [],
      });
    }
    return false;
  }

  if (downloadedTrack.artworkLocalUri) {
    const savedArtworkRef = await saveOfflineMediaFileRef(
      downloadedTrack.id,
      "artwork",
      downloadedTrack.artworkLocalUri,
    );

    if (!savedArtworkRef && createdNativeFiles.artwork) {
      await cleanupCreatedNativeFiles({
        audio: [],
        artwork: [downloadedTrack.id],
      });
    }
  }

  return true;
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
  if (signal?.aborted) {
    return {
      blocked: false,
      blockedByMode: false,
      error: null,
      cancelled: true,
      totalLibraryTracks: 0,
      totalMissingTracks: 0,
      downloadedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      downloadedBytes: 0,
    };
  }

  const libraryStatus = await getFullLibraryDownloadStatus({
    mode,
    includeTracks: true,
  });

  if (libraryStatus.blockedByMode) {
    return {
      blocked: true,
      blockedByMode: true,
      error: null,
      cancelled: false,
      totalLibraryTracks: 0,
      totalMissingTracks: 0,
      downloadedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      downloadedBytes: 0,
    };
  }

  if (!libraryStatus.available) {
    return {
      blocked: false,
      blockedByMode: false,
      error: "library_unavailable",
      cancelled: false,
      totalLibraryTracks: 0,
      totalMissingTracks: 0,
      downloadedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      downloadedBytes: 0,
    };
  }

  const allTracks = Array.isArray(libraryStatus.tracks) ? libraryStatus.tracks : [];
  const missingTracks = [];

  for (const track of allTracks) {
    const trackId = normalizeTrackId(track);

    if (!trackId) {
      continue;
    }

    if (!(await hasVerifiedOfflineTrack(trackId))) {
      missingTracks.push(track);
    }
  }

  let processedMissingTracks = 0;
  let downloadedCount = 0;
  let skippedCount = libraryStatus.alreadyDownloadedCount;
  let failedCount = 0;
  let downloadedBytes = 0;

  onProgress?.(
    buildLibraryProgress({
      totalLibraryTracks: allTracks.length,
      totalMissingTracks: missingTracks.length,
      processedMissingTracks,
      downloadedCount,
      skippedCount,
      failedCount,
      downloadedBytes,
    }),
  );

  for (const track of missingTracks) {
    if (signal?.aborted) {
      return {
        blocked: false,
        cancelled: true,
        totalLibraryTracks: allTracks.length,
        totalMissingTracks: missingTracks.length,
        downloadedCount,
        skippedCount,
        failedCount,
        downloadedBytes,
      };
    }

    const result = await downloadTrackForOffline(track, {
      downloadedAt: new Date().toISOString(),
      signal,
      abortDuringTrack: false,
    });

    processedMissingTracks += 1;

    if (result.status === "failed") {
      failedCount += 1;
      onProgress?.(
        buildLibraryProgress({
          totalLibraryTracks: allTracks.length,
          totalMissingTracks: missingTracks.length,
          processedMissingTracks,
          downloadedCount,
          skippedCount,
          failedCount,
          downloadedBytes,
          currentTrackTitle: result.title,
        }),
      );
      continue;
    }

    if (result.status === "existing") {
      skippedCount += 1;
      onProgress?.(
        buildLibraryProgress({
          totalLibraryTracks: allTracks.length,
          totalMissingTracks: missingTracks.length,
          processedMissingTracks,
          downloadedCount,
          skippedCount,
          failedCount,
          downloadedBytes,
          currentTrackTitle: result.title,
        }),
      );
      continue;
    }

    const persisted = shouldUseMobileOfflineSqlite()
      ? await persistNativeLibraryTrack(
          result.downloadedTrack,
          result.createdNativeFiles,
        )
      : await persistBrowserLibraryTrack(result.downloadedTrack);

    if (!persisted) {
      failedCount += 1;
    } else {
      downloadedCount += 1;
      downloadedBytes += result.downloadedBytes || 0;
    }

    onProgress?.(
      buildLibraryProgress({
        totalLibraryTracks: allTracks.length,
        totalMissingTracks: missingTracks.length,
        processedMissingTracks,
        downloadedCount,
        skippedCount,
        failedCount,
        downloadedBytes,
        currentTrackTitle: result.title,
      }),
    );
  }

  return {
    blocked: false,
    blockedByMode: false,
    error: null,
    cancelled: false,
    totalLibraryTracks: allTracks.length,
    totalMissingTracks: missingTracks.length,
    downloadedCount,
    skippedCount,
    failedCount,
    downloadedBytes,
  };
}
