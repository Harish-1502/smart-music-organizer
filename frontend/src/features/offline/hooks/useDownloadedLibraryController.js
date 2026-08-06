import { useEffect, useState } from "react";

import {
  getAppMode,
  isLanMode,
  subscribeToAppModeChanges,
} from "../../../appMode/appMode";
import {
  cancelFullLibraryDownload,
  downloadFullLibraryForOffline,
  getFullLibraryDownloadRuntimeState,
  getFullLibraryDownloadStatus,
  subscribeToFullLibraryDownloadState,
} from "../services/downloadLibrary";
import { buildLibraryTransferSummary } from "../utils/downloadedPageText";
import {
  createEmptyLibraryProgress,
  createOfflineDatabaseUnavailableUiMessage,
} from "../utils/downloadedPageData";

export function useDownloadedLibraryController({
  initialAppMode = null,
  initialLibraryStatus = null,
  initialLoading = null,
  initialIsLibraryDownloading = false,
  initialLibraryProgress = null,
  onRefreshOfflineData,
  clearMessage,
  showErrorMessage,
}) {
  const fullLibraryRuntimeState = getFullLibraryDownloadRuntimeState();
  const [appMode, setAppMode] = useState(() => initialAppMode ?? getAppMode());
  const lanModeEnabled = isLanMode(appMode);
  const [libraryStatus, setLibraryStatus] = useState(
    () => initialLibraryStatus,
  );
  const [isLibraryLoading, setIsLibraryLoading] = useState(
    () => initialLoading ?? initialLibraryStatus === null,
  );
  const [isLibraryDownloading, setIsLibraryDownloading] = useState(
    initialIsLibraryDownloading ?? fullLibraryRuntimeState.isRunning,
  );
  const [libraryProgress, setLibraryProgress] = useState(
    () =>
      initialLibraryProgress ??
      fullLibraryRuntimeState.progress ??
      createEmptyLibraryProgress(),
  );

  // Used to stay in sync with the app mode changes, so that the library
  // download status can be reloaded when the app mode changes.
  useEffect(() => subscribeToAppModeChanges(setAppMode), []);

  // Used to stay in sync with the full library download state, so the UI can
  // reflect the current download progress and status.
  useEffect(() => {
    return subscribeToFullLibraryDownloadState((runtimeState) => {
      setIsLibraryDownloading(runtimeState.isRunning);
      setLibraryProgress(runtimeState.progress ?? createEmptyLibraryProgress());
    });
  }, []);

  // Checks whether the full-library download is available.
  useEffect(() => {
    let isMounted = true;

    async function loadLibraryStatus() {
      if (!lanModeEnabled) {
        if (isMounted) {
          setLibraryStatus({
            available: false,
            blockedByMode: true,
            totalLibraryTracks: 0,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: null,
            lastSafeErrorMessage: "",
          });
          setIsLibraryLoading(false);
        }
        return;
      }

      setIsLibraryLoading(true);

      try {
        const nextLibraryStatus = await getFullLibraryDownloadStatus({
          mode: appMode,
        });

        if (isMounted) {
          setLibraryStatus(nextLibraryStatus);
        }
      } catch {
        if (isMounted) {
          setLibraryStatus({
            available: false,
            blockedByMode: false,
            totalLibraryTracks: 0,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: "library_unavailable",
            lastSafeErrorMessage:
              "Could not load your PC library for offline download.",
          });
        }
      } finally {
        if (isMounted) {
          setIsLibraryLoading(false);
        }
      }
    }

    loadLibraryStatus();

    return () => {
      isMounted = false;
    };
  }, [appMode, lanModeEnabled]);

  // Refreshes the full-library download status based on the current app mode.
  async function reloadLibraryStatus() {
    if (!lanModeEnabled) {
      setLibraryStatus({
        available: false,
        blockedByMode: true,
        totalLibraryTracks: 0,
        alreadyDownloadedCount: 0,
        missingDownloadCount: 0,
        estimatedSizeAvailable: false,
        error: null,
        lastSafeErrorMessage: "",
      });
      setIsLibraryLoading(false);
      return;
    }

    setIsLibraryLoading(true);

    try {
      const nextLibraryStatus = await getFullLibraryDownloadStatus({
        mode: appMode,
      });
      setLibraryStatus(nextLibraryStatus);
    } catch {
      setLibraryStatus({
        available: false,
        blockedByMode: false,
        totalLibraryTracks: 0,
        alreadyDownloadedCount: 0,
        missingDownloadCount: 0,
        estimatedSizeAvailable: false,
        error: "library_unavailable",
        lastSafeErrorMessage:
          "Could not load your PC library for offline download.",
      });
    } finally {
      setIsLibraryLoading(false);
    }
  }

  // Handles the download the full library for offline use, checking for LAN
  // mode and download status, and updating the UI with progress, success, or
  // error messages.
  async function handleDownloadFullLibrary() {
    if (!lanModeEnabled || isLibraryDownloading) {
      return;
    }

    clearMessage?.();

    try {
      const result = await downloadFullLibraryForOffline({
        mode: appMode,
      });

      let nextMessage = "";
      let nextTone = "success";

      if (result.blockedByMode) {
        nextMessage = "Switch to LAN Mode to download from your PC library.";
        nextTone = "warning";
      } else if (result.error === "offline_database_unavailable") {
        nextMessage = createOfflineDatabaseUnavailableUiMessage();
        nextTone = "error";
      } else if (result.error === "library_unavailable") {
        nextMessage = "Could not load your PC library for offline download.";
        nextTone = "error";
      } else if (result.cancelled) {
        nextMessage = `Cancelled - verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed ${result.failedCount}.`;
        nextTone = "warning";
      } else if (result.totalMissingTracks === 0) {
        nextMessage =
          result.totalLibraryTracks === 0
            ? "No tracks found in your PC library right now."
            : "All library tracks are already downloaded for offline use.";
        nextTone = "success";
      } else if (result.failedCount > 0) {
        nextMessage = `Verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed ${result.failedCount}.`;
        nextTone = "warning";
      } else {
        nextMessage = `Verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed 0.`;
        nextTone = "success";
      }

      if (
        result.lastSafeErrorMessage &&
        result.error !== "offline_database_unavailable"
      ) {
        nextMessage = `${nextMessage} Last issue: ${result.lastSafeErrorMessage}`;
      }

      await onRefreshOfflineData?.(nextMessage, nextTone);
    } catch {
      showErrorMessage?.("Could not download the full library for offline use.");
    } finally {
      await reloadLibraryStatus();
    }
  }

  function handleCancelFullLibraryDownload() {
    cancelFullLibraryDownload();
  }

  return {
    appMode,
    lanModeEnabled,
    libraryStatus,
    isLibraryLoading,
    isLibraryDownloading,
    libraryProgress,
    libraryTracksKnown: Number.isFinite(Number(libraryStatus?.totalLibraryTracks))
      ? Number(libraryStatus.totalLibraryTracks)
      : 0,
    libraryDatabaseUnavailable:
      libraryStatus?.error === "offline_database_unavailable",
    reloadLibraryStatus,
    handleDownloadFullLibrary,
    handleCancelFullLibraryDownload,
    buildLibraryTransferSummary,
    createOfflineDatabaseUnavailableUiMessage,
  };
}
