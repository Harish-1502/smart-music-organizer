import { saveDownloadedPlaylist } from "./offlineStorage";
import {
  saveNativeDownloadedPlaylist,
  shouldUseMobileOfflineSqlite,
} from "./mobileOfflineRepository";
import {
  cleanupCreatedNativeFiles,
  createAbortError,
  downloadTrackForOffline,
} from "./offlineTrackDownload";

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

async function downloadPlaylistTracks({
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
      if (shouldUseMobileOfflineSqlite()) {
        await cleanupCreatedNativeFiles(createdNativeFiles);
      }
      throw createAbortError();
    }

    const result = await downloadTrackForOffline(track, {
      downloadedAt,
      signal,
      abortDuringTrack: true,
    });

    if (result.status === "failed") {
      failedTracks += 1;
      failedTrackIds.push(result.trackId);
      onProgress?.(
        buildProgress({
          totalTracks,
          completedTracks,
          failedTracks,
          downloadedBytes,
          currentTrackTitle: result.title,
        }),
      );
      continue;
    }

    if (result.createdNativeFiles?.audio) {
      createdNativeFiles.audio.push(result.trackId);
    }

    if (result.createdNativeFiles?.artwork) {
      createdNativeFiles.artwork.push(result.trackId);
    }

    successfulTracks.push(result.downloadedTrack);
    completedTracks += 1;
    downloadedBytes += result.downloadedBytes || 0;

    onProgress?.(
      buildProgress({
        totalTracks,
        completedTracks,
        failedTracks,
        downloadedBytes,
        currentTrackTitle: result.title,
      }),
    );
  }

  if (signal?.aborted) {
    if (shouldUseMobileOfflineSqlite()) {
      await cleanupCreatedNativeFiles(createdNativeFiles);
    }
    throw createAbortError();
  }

  return {
    totalTracks,
    downloadedAt,
    successfulTracks,
    failedTrackIds,
    failedTracks,
    downloadedBytes,
    createdNativeFiles,
  };
}

async function downloadPlaylistForBrowser({
  playlist,
  onProgress,
  signal,
}) {
  const result = await downloadPlaylistTracks({
    playlist,
    onProgress,
    signal,
  });

  if (result.successfulTracks.length === 0) {
    return {
      totalTracks: result.totalTracks,
      completedTracks: 0,
      failedTracks: result.failedTracks,
      downloadedBytes: result.downloadedBytes,
      failedTrackIds: result.failedTrackIds,
      savedPlaylist: null,
    };
  }

  const savedPlaylist = await saveDownloadedPlaylist({
    id: playlist?.id,
    name: playlist?.name,
    tracks: result.successfulTracks,
    downloadedAt: result.downloadedAt,
    requestedTrackCount: result.totalTracks,
    failedTrackCount: result.failedTracks,
  });

  return {
    totalTracks: result.totalTracks,
    completedTracks: result.successfulTracks.length,
    failedTracks: result.failedTracks,
    downloadedBytes: result.downloadedBytes,
    failedTrackIds: result.failedTrackIds,
    savedPlaylist,
  };
}

async function downloadPlaylistForNativeAndroid({
  playlist,
  onProgress,
  signal,
}) {
  const result = await downloadPlaylistTracks({
    playlist,
    onProgress,
    signal,
  });

  if (result.successfulTracks.length === 0) {
    return {
      totalTracks: result.totalTracks,
      completedTracks: 0,
      failedTracks: result.failedTracks,
      downloadedBytes: result.downloadedBytes,
      failedTrackIds: result.failedTrackIds,
      savedPlaylist: null,
    };
  }

  const savedPlaylist = await saveNativeDownloadedPlaylist({
    id: playlist?.id,
    name: playlist?.name,
    tracks: result.successfulTracks,
    downloadedAt: result.downloadedAt,
    requestedTrackCount: result.totalTracks,
    failedTrackCount: result.failedTracks,
  });

  if (!savedPlaylist) {
    await cleanupCreatedNativeFiles(result.createdNativeFiles);
    throw new Error("Could not save native offline playlist metadata.");
  }

  return {
    totalTracks: result.totalTracks,
    completedTracks: result.successfulTracks.length,
    failedTracks: result.failedTracks,
    downloadedBytes: result.downloadedBytes,
    failedTrackIds: result.failedTrackIds,
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
