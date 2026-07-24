import { useEffect, useRef, useState } from "react";

import { getSafeErrorMessage } from "../../../utils/formatSafeError";
import {
  buildOfflinePlaybackQueue,
  clearOfflineData,
  deleteOfflinePlaylist,
  getOfflinePlaylists,
  getOfflineStorageSummary,
  OfflineDatabaseUnavailableError,
} from "../storage/mobileOfflineRepository";
import {
  buildClearAllDownloadsConfirmationText,
  buildDeleteDownloadConfirmationText,
  getMissingAudioWarningMessage,
} from "../utils/downloadedPageText";
import {
  createOfflineDatabaseUnavailableUiMessage,
  sortPlaylistsByDownloadedDate,
} from "../utils/downloadedPageData";

const DEBUG_TAG = "downloaded-storage-controller";

function logDebug(phase, details = {}) {
  console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function logWarn(phase, details = {}) {
  console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

export function useDownloadedStorageController({
  initialSummary = null,
  initialPlaylists = null,
  initialLoading = null,
  navigate,
  playQueue,
  onStorageChanged,
  clearMessage,
  setFeedback,
  showSuccessMessage,
  showWarningMessage,
  showErrorMessage,
}) {
  const isMountedRef = useRef(true);
  const [summary, setSummary] = useState(() => initialSummary);
  const [playlists, setPlaylists] = useState(() => initialPlaylists ?? []);
  const [isStorageLoading, setIsStorageLoading] = useState(
    () => initialLoading ?? initialSummary === null,
  );
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load the offline storage summary and downloaded playlists when the
  // controller mounts.
  useEffect(() => {
    let isMounted = true;

    // Load the offline storage summary and downloaded playlists and handles
    // any errors that occur.
    async function loadOfflineData() {
      setIsStorageLoading(true);
      clearMessage?.();

      try {
        const nextSummary = await getOfflineStorageSummary();
        const nextPlaylists = await getOfflinePlaylists();

        if (!isMounted) {
          return;
        }

        setSummary(nextSummary);
        setPlaylists(sortPlaylistsByDownloadedDate(nextPlaylists));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSummary({
          available: false,
          playlistCount: 0,
          trackCount: 0,
          totalBytes: 0,
        });
        setPlaylists([]);
        showErrorMessage?.(
          error instanceof OfflineDatabaseUnavailableError
            ? createOfflineDatabaseUnavailableUiMessage()
            : getSafeErrorMessage(
                error,
                "Unable to load downloaded playlists.",
              ),
        );
      } finally {
        if (isMounted) {
          setIsStorageLoading(false);
        }
      }
    }

    loadOfflineData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Reloads the offline storage summary after a local offline action.
  async function reloadOfflineData(
    nextMessage = "",
    nextMessageTone = "success",
  ) {
    if (!isMountedRef.current) {
      return;
    }

    setIsStorageLoading(true);
    setFeedback?.(nextMessage, nextMessageTone);

    try {
      const nextSummary = await getOfflineStorageSummary();
      const nextPlaylists = await getOfflinePlaylists();

      if (!isMountedRef.current) {
        return;
      }

      setSummary(nextSummary);
      setPlaylists(sortPlaylistsByDownloadedDate(nextPlaylists));
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setSummary({
        available: false,
        playlistCount: 0,
        trackCount: 0,
        totalBytes: 0,
      });
      setPlaylists([]);
      showErrorMessage?.(
        error instanceof OfflineDatabaseUnavailableError
          ? createOfflineDatabaseUnavailableUiMessage()
          : getSafeErrorMessage(
              error,
              "Unable to refresh downloaded playlists.",
            ),
      );
    } finally {
      if (isMountedRef.current) {
        setIsStorageLoading(false);
      }
    }
  }

  // Handles the deletion of a downloaded playlist, prompting the user for
  // confirmation and updating the UI accordingly.
  async function handleDeletePlaylist(playlistId) {
    const playlist = playlists.find((entry) => entry.id === playlistId);
    const confirmed = window.confirm(
      buildDeleteDownloadConfirmationText(playlist?.name),
    );

    if (!confirmed) {
      return;
    }

    const deleted = await deleteOfflinePlaylist(playlistId);

    if (!deleted) {
      showErrorMessage?.("Could not delete the downloaded playlist.");
      return;
    }

    await reloadOfflineData();
    showSuccessMessage?.("Downloaded playlist removed.");
    await onStorageChanged?.();
  }

  // Used to clear all stored offline downloads.
  async function handleClearAll() {
    const confirmed = window.confirm(
      buildClearAllDownloadsConfirmationText(summary),
    );

    if (!confirmed) {
      return;
    }

    const cleared = await clearOfflineData();

    if (!cleared) {
      showErrorMessage?.("Could not clear offline downloads.");
      return;
    }

    await reloadOfflineData();
    showSuccessMessage?.("Offline downloads cleared.");
    await onStorageChanged?.();
  }

  // The entry point for offline playback of a downloaded playlist. It builds
  // the offline playback queue and navigates to the player page, handling any
  // errors or missing tracks.
  async function handlePlayOffline(playlistId) {
    logDebug("play-offline-requested", {
      playlistId,
    });

    const playbackQueue = await buildOfflinePlaybackQueue(playlistId);

    if (!playbackQueue) {
      logWarn("play-offline-queue-missing", {
        playlistId,
      });
      showErrorMessage?.(
        "Could not load this downloaded playlist for offline playback.",
      );
      return;
    }

    if (!playbackQueue.tracks.length) {
      logWarn("play-offline-no-tracks", {
        playlistId,
        missingTrackIds: playbackQueue.missingTrackIds.length,
      });
      showErrorMessage?.(
        "No playable offline audio files were found for this playlist.",
      );
      return;
    }

    logDebug("play-offline-queue-ready", {
      playlistId,
      trackCount: playbackQueue.tracks.length,
      missingTrackCount: playbackQueue.missingTrackIds.length,
      firstTrackId:
        playbackQueue.tracks[0]?.track_id ?? playbackQueue.tracks[0]?.id ?? null,
    });

    playQueue(playbackQueue.tracks, 0);
    navigate("/player");

    if (playbackQueue.missingTrackIds.length > 0) {
      showWarningMessage?.(
        `Playing offline with ${playbackQueue.tracks.length} tracks. ${playbackQueue.missingTrackIds.length} missing files were skipped.`,
      );
      return;
    }

    showSuccessMessage?.(
      `Playing ${playbackQueue.playlistName || "downloaded playlist"} offline.`,
    );
  }

  return {
    summary,
    playlists,
    isStorageLoading,
    hasPlaylists: playlists.length > 0,
    storageAvailable: Boolean(summary?.available),
    missingAudioWarning: getMissingAudioWarningMessage(summary),
    reloadOfflineData,
    handleDeletePlaylist,
    handleClearAll,
    handlePlayOffline,
  };
}
