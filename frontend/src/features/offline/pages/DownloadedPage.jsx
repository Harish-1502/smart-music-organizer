import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAppMode,
  isLanMode,
  subscribeToAppModeChanges,
} from "../../../appMode/appMode";
import { usePlayer } from "../../player/context/PlayerContext";
import DownloadedPlaylistsSection from "../components/DownloadedPlaylistsSection";
import {
  cancelFullLibraryDownload,
  downloadFullLibraryForOffline,
  getFullLibraryDownloadRuntimeState,
  getFullLibraryDownloadStatus,
  subscribeToFullLibraryDownloadState,
} from "../services/downloadLibrary";
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
  buildLibraryTransferSummary,
  formatDownloadedDate,
  formatStorageSize,
  formatStorageType,
  getMissingAudioWarningMessage,
  sanitizeLibraryProgressTitle,
} from "../utils/downloadedPageText";
import {
  createEmptyLibraryProgress,
  createOfflineDatabaseUnavailableUiMessage,
  sortPlaylistsByDownloadedDate,
} from "../utils/downloadedPageData";
import { getSafeErrorMessage } from "../../../utils/formatSafeError";
import "../styles/DownloadedPage.css";

export {
  buildClearAllDownloadsConfirmationText,
  buildDeleteDownloadConfirmationText,
  getMissingAudioWarningMessage,
  sanitizeLibraryProgressTitle,
} from "../utils/downloadedPageText";

export default function DownloadedPage({
  initialAppMode = null,
  initialSummary = null,
  initialPlaylists = null,
  initialLibraryStatus = null,
  initialLoading = null,
  initialIsLibraryDownloading = false,
  initialLibraryProgress = null,
}) {
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const isMountedRef = useRef(true);
  const fullLibraryRuntimeState = getFullLibraryDownloadRuntimeState();
  const [appMode, setAppMode] = useState(() => initialAppMode ?? getAppMode());
  const lanModeEnabled = isLanMode(appMode);
  const [summary, setSummary] = useState(() => initialSummary);
  const [playlists, setPlaylists] = useState(() => initialPlaylists ?? []);
  const [libraryStatus, setLibraryStatus] = useState(
    () => initialLibraryStatus,
  );
  const [loading, setLoading] = useState(
    () => initialLoading ?? initialSummary === null,
  );
  const [libraryLoading, setLibraryLoading] = useState(
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
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  // Used to stay in sync with the app mode changes, so that the library download status can be reloaded when the app mode changes.
  useEffect(() => subscribeToAppModeChanges(setAppMode), []);

  // Used to stay in sync with the full library download state, so the UI can reflect the current download progress and status.
  useEffect(() => {
    return subscribeToFullLibraryDownloadState((runtimeState) => {
      if (!isMountedRef.current) {
        return;
      }

      setIsLibraryDownloading(runtimeState.isRunning);
      setLibraryProgress(runtimeState.progress ?? createEmptyLibraryProgress());
    });
  }, []);

  // Load the offline storage summary and downloaded playlists when the component mounts.
  useEffect(() => {
    let isMounted = true;

    // Load the offline storage summary and downloaded playlists and handles any errors that occur
    async function loadOfflineData() {
      setLoading(true);
      setMessage("");
      setMessageTone("success");

      try {
        const nextSummary = await getOfflineStorageSummary();
        const nextPlaylists = await getOfflinePlaylists();

        if (!isMounted) {
          return;
        }

        setSummary(nextSummary);
        setPlaylists(sortPlaylistsByDownloadedDate(nextPlaylists));
      } catch (error) {
        if (isMounted) {
          setSummary({
            available: false,
            playlistCount: 0,
            trackCount: 0,
            totalBytes: 0,
          });
          setPlaylists([]);
          setMessage(
            error instanceof OfflineDatabaseUnavailableError
              ? createOfflineDatabaseUnavailableUiMessage()
              : getSafeErrorMessage(
                  error,
                  "Unable to load downloaded playlists.",
                ),
          );
          setMessageTone("error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOfflineData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Checks whether the full-library download is available 
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
          setLibraryLoading(false);
        }
        return;
      }

      setLibraryLoading(true);

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
          setLibraryLoading(false);
        }
      }
    }

    loadLibraryStatus();

    return () => {
      isMounted = false;
    };
  }, [appMode, lanModeEnabled]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reloads the offline storage summary after an action in the DownloadedPage
  async function reloadOfflineData(
    nextMessage = "",
    nextMessageTone = "success",
  ) {
    if (!isMountedRef.current) {
      return;
    }

    setLoading(true);
    setMessage(nextMessage);
    setMessageTone(nextMessageTone);

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
      setMessage(
        error instanceof OfflineDatabaseUnavailableError
          ? createOfflineDatabaseUnavailableUiMessage()
          : getSafeErrorMessage(
              error,
              "Unable to refresh downloaded playlists.",
            ),
      );
      setMessageTone("error");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  // Refreshed the full-library download status based on the current app mode
  async function reloadLibraryStatus() {
    if (!isMountedRef.current) {
      return;
    }

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
      setLibraryLoading(false);
      return;
    }

    setLibraryLoading(true);

    try {
      const nextLibraryStatus = await getFullLibraryDownloadStatus({
        mode: appMode,
      });
      if (!isMountedRef.current) {
        return;
      }
      setLibraryStatus(nextLibraryStatus);
    } catch {
      if (!isMountedRef.current) {
        return;
      }
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
      if (isMountedRef.current) {
        setLibraryLoading(false);
      }
    }
  }

  // Handles the deletion of a downloaded playlist, prompting the user for confirmation and updating the UI accordingly.
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
      setMessage("Could not delete the downloaded playlist.");
      setMessageTone("error");
      return;
    }

    await reloadOfflineData("Downloaded playlist removed.", "success");
    await reloadLibraryStatus();
  }

  // Used to clear all stored offline dowloads
  async function handleClearAll() {
    const confirmed = window.confirm(
      buildClearAllDownloadsConfirmationText(summary),
    );

    if (!confirmed) {
      return;
    }

    const cleared = await clearOfflineData();

    if (!cleared) {
      setMessage("Could not clear offline downloads.");
      setMessageTone("error");
      return;
    }

    await reloadOfflineData("Offline downloads cleared.", "success");
    await reloadLibraryStatus();
  }

  const hasPlaylists = playlists.length > 0;
  const storageAvailable = Boolean(summary?.available);
  const missingAudioWarning = getMissingAudioWarningMessage(summary);
  const libraryTracksKnown = Number.isFinite(
    Number(libraryStatus?.totalLibraryTracks),
  )
    ? Number(libraryStatus.totalLibraryTracks)
    : 0;
  const libraryDatabaseUnavailable =
    libraryStatus?.error === "offline_database_unavailable";
  const libraryUnavailable = libraryStatus?.error === "library_unavailable";

  // The entry point for offline playback of a downloaded playlist. It builds the offline playback queue and navigates to the player page, handling any errors or missing tracks.
  async function handlePlayOffline(playlistId) {
    const playbackQueue = await buildOfflinePlaybackQueue(playlistId);

    if (!playbackQueue) {
      setMessage(
        "Could not load this downloaded playlist for offline playback.",
      );
      setMessageTone("error");
      return;
    }

    if (!playbackQueue.tracks.length) {
      setMessage(
        "No playable offline audio files were found for this playlist.",
      );
      setMessageTone("error");
      return;
    }

    playQueue(playbackQueue.tracks, 0);
    navigate("/player");

    if (playbackQueue.missingTrackIds.length > 0) {
      setMessage(
        `Playing offline with ${playbackQueue.tracks.length} tracks. ${playbackQueue.missingTrackIds.length} missing files were skipped.`,
      );
      setMessageTone("warning");
      return;
    }

    setMessage(
      `Playing ${playbackQueue.playlistName || "downloaded playlist"} offline.`,
    );
    setMessageTone("success");
  }

  // Handles the download the full library for offline use, checking for LAN mode and download status, and updating the UI with progress, success, or error messages.
  async function handleDownloadFullLibrary() {
    if (!lanModeEnabled || isLibraryDownloading) {
      return;
    }

    setMessage("");
    setMessageTone("success");

    try {
      const result = await downloadFullLibraryForOffline({
        mode: appMode,
      });

      if (!isMountedRef.current) {
        return;
      }

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
        ((nextMessage = `Cancelled - verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed ${result.failedCount}.`),
          (nextTone = "warning"));
      } else if (result.totalMissingTracks === 0) {
        nextMessage =
          result.totalLibraryTracks === 0
            ? "No tracks found in your PC library right now."
            : "All library tracks are already downloaded for offline use.";
        nextTone = "success";
      } else if (result.failedCount > 0) {
        ((nextMessage = `Verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed ${result.failedCount}.`),
          (nextTone = "warning"));
      } else {
        ((nextMessage = `Verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed 0.`),
          (nextTone = "success"));
      }

      if (
        result.lastSafeErrorMessage &&
        result.error !== "offline_database_unavailable"
      ) {
        nextMessage = `${nextMessage} Last issue: ${result.lastSafeErrorMessage}`;
      }

      await reloadOfflineData(nextMessage, nextTone);
    } catch {
      if (isMountedRef.current) {
        setMessage("Could not download the full library for offline use.");
        setMessageTone("error");
      }
    } finally {
      await reloadLibraryStatus();
    }
  }

  function handleCancelFullLibraryDownload() {
    cancelFullLibraryDownload();
  }

  return (
    <section className="downloaded-page" aria-labelledby="downloaded-title">
      <div className="downloaded-page__inner">
        <header className="downloaded-page__hero">
          <div className="downloaded-page__hero-copy">
            <p className="downloaded-page__eyebrow">Offline foundation</p>
            <h1 id="downloaded-title" className="downloaded-page__title">
              Downloaded
            </h1>
            <p className="downloaded-page__lead">
              Review what is already stored for offline listening. No API token
              or PC file path is shown here.
            </p>
          </div>

          <div
            className="downloaded-page__summary-grid"
            aria-label="Offline storage summary"
          >
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Storage</span>
              <span className="downloaded-page__summary-value">
                {storageAvailable ? "Available" : "Unavailable"}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Playlists</span>
              <span className="downloaded-page__summary-value">
                {summary?.playlistCount ?? 0}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                Storage type
              </span>
              <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
                {formatStorageType(summary?.storageType)}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Tracks</span>
              <span className="downloaded-page__summary-value">
                {summary?.trackCount ?? 0}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Audio size</span>
              <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
                {formatStorageSize(summary?.totalAudioBytes ?? 0)}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                Artwork size
              </span>
              <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
                {formatStorageSize(summary?.totalArtworkBytes ?? 0)}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                Offline total
              </span>
              <span className="downloaded-page__summary-value">
                {formatStorageSize(summary?.totalBytes ?? 0)}
              </span>
            </div>
          </div>
        </header>

        <section
          className="downloaded-page__library-card"
          aria-labelledby="offline-library-title"
        >
          <div className="downloaded-page__library-copy">
            <p className="downloaded-page__section-eyebrow">Offline Library</p>
            <h2
              id="offline-library-title"
              className="downloaded-page__section-title"
            >
              Full library download
            </h2>
            <p className="downloaded-page__state-text">
              Download your PC music library for Offline Mode browsing and
              playback.
            </p>
          </div>

          <div
            className="downloaded-page__summary-grid"
            aria-label="Offline library download summary"
          >
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                PC library tracks
              </span>
              <span className="downloaded-page__summary-value">
                {libraryLoading ? "..." : libraryTracksKnown}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                Already downloaded
              </span>
              <span className="downloaded-page__summary-value">
                {isLibraryDownloading
                  ? Number(libraryProgress.verifiedExistingCount ?? 0) +
                    Number(libraryProgress.downloadedCount ?? 0) +
                    Number(libraryProgress.skippedCount ?? 0)
                  : libraryLoading
                    ? "..."
                    : libraryStatus?.available
                      ? libraryStatus.alreadyDownloadedCount
                      : libraryDatabaseUnavailable
                        ? "--"
                        : 0}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                New downloads
              </span>
              <span className="downloaded-page__summary-value">
                {isLibraryDownloading
                  ? Math.max(
                      libraryProgress.totalMissingTracks -
                        libraryProgress.processedMissingTracks,
                      0,
                    )
                  : libraryLoading
                    ? "..."
                    : libraryStatus?.available
                      ? libraryStatus.missingDownloadCount
                      : libraryDatabaseUnavailable
                        ? "--"
                        : 0}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">
                Estimated size
              </span>
              <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
                Estimated size unavailable
              </span>
            </div>
          </div>

          {!lanModeEnabled ? (
            <p className="downloaded-page__library-note">
              Switch to LAN Mode to download from your PC library.
            </p>
          ) : null}

          {lanModeEnabled && !libraryLoading && libraryDatabaseUnavailable ? (
            <p className="downloaded-page__library-note">
              {createOfflineDatabaseUnavailableUiMessage()}
            </p>
          ) : null}

          {lanModeEnabled &&
          !libraryLoading &&
          !libraryStatus?.available &&
          !libraryDatabaseUnavailable ? (
            <p className="downloaded-page__library-note">
              Connect to your PC backend in LAN Mode to inspect the full
              library.
            </p>
          ) : null}

          {lanModeEnabled &&
          !libraryLoading &&
          libraryStatus?.available &&
          libraryStatus.totalLibraryTracks === 0 ? (
            <p className="downloaded-page__library-note">
              No tracks found in your PC library right now.
            </p>
          ) : null}

          {isLibraryDownloading ? (
            <div className="downloaded-page__download-card" aria-live="polite">
              <p className="downloaded-page__warning-title">
                Downloading full library
              </p>
              <p className="downloaded-page__warning-text">
                {libraryProgress.processedMissingTracks} /{" "}
                {libraryProgress.totalMissingTracks} missing tracks processed.{" "}
                {buildLibraryTransferSummary(libraryProgress)} Fetched{" "}
                {formatStorageSize(libraryProgress.downloadedBytes)} so far.
              </p>
              {libraryProgress.currentTrackTitle ? (
                <p className="downloaded-page__warning-text">
                  Current track:{" "}
                  {sanitizeLibraryProgressTitle(
                    libraryProgress.currentTrackTitle,
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="downloaded-page__library-actions">
            <button
              type="button"
              className="downloaded-page__button"
              onClick={handleDownloadFullLibrary}
              disabled={
                !lanModeEnabled ||
                isLibraryDownloading ||
                libraryLoading ||
                !libraryStatus?.available
              }
            >
              {isLibraryDownloading
                ? "Downloading library..."
                : "Download Full Library"}
            </button>
            {isLibraryDownloading ? (
              <button
                type="button"
                className="downloaded-page__button downloaded-page__button--secondary"
                onClick={handleCancelFullLibraryDownload}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </section>

        <DownloadedPlaylistsSection
          loading={loading}
          summary={summary}
          storageAvailable={storageAvailable}
          hasPlaylists={hasPlaylists}
          playlists={playlists}
          missingAudioWarning={missingAudioWarning}
          message={message}
          messageTone={messageTone}
          onClearAll={handleClearAll}
          onPlayOffline={handlePlayOffline}
          onDeletePlaylist={handleDeletePlaylist}
          formatStorageSize={formatStorageSize}
          formatDownloadedDate={formatDownloadedDate}
        />
      </div>
    </section>
  );
}
