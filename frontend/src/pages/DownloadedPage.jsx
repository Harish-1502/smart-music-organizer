import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAppMode,
  isLanMode,
  subscribeToAppModeChanges,
} from "../appMode/appMode";
import { usePlayer } from "../context/PlayerContext";
import {
  cancelFullLibraryDownload,
  downloadFullLibraryForOffline,
  getFullLibraryDownloadRuntimeState,
  getFullLibraryDownloadStatus,
  subscribeToFullLibraryDownloadState,
} from "../offline/downloadLibrary";
import {
  buildOfflinePlaybackQueue,
  clearOfflineData,
  deleteOfflinePlaylist,
  getOfflinePlaylists,
  getOfflineStorageSummary,
  OfflineDatabaseUnavailableError,
} from "../offline/mobileOfflineRepository";
import { getSafeErrorMessage } from "../utils/formatSafeError";
import "../styles/DownloadedPage.css";

export function formatStorageSize(totalBytes) {
  const size = Number(totalBytes);

  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** unitIndex;

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatStorageType(storageType) {
  if (storageType === "native_file") {
    return "Native files";
  }

  if (storageType === "indexeddb" || storageType === "indexeddb_blob") {
    return "IndexedDB";
  }

  return "Unknown";
}

function formatDownloadedDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

export function buildDeleteDownloadConfirmationText(playlistName) {
  const safePlaylistName =
    typeof playlistName === "string" && playlistName.trim()
      ? playlistName.trim()
      : "this playlist";

  return `Delete the offline download for ${safePlaylistName}? Shared tracks used by other downloaded playlists will be kept.`;
}

export function buildClearAllDownloadsConfirmationText(summary) {
  return `Clear all offline downloads? This removes ${summary?.playlistCount ?? 0} playlists, ${summary?.trackCount ?? 0} tracks, and ${formatStorageSize(summary?.totalBytes ?? 0)} from ${formatStorageType(summary?.storageType)} storage.`;
}

export function getMissingAudioWarningMessage(summary) {
  const missingAudioFileCount = Number(summary?.missingAudioFileCount ?? 0);

  if (!Number.isFinite(missingAudioFileCount) || missingAudioFileCount <= 0) {
    return "";
  }

  return `${missingAudioFileCount} offline audio file${missingAudioFileCount === 1 ? "" : "s"} ${missingAudioFileCount === 1 ? "is" : "are"} missing. Play Offline will skip unavailable tracks until those downloads are refreshed.`;
}

function sortPlaylistsByDownloadedDate(playlists) {
  return [...playlists].sort((left, right) => {
    const leftDate = new Date(left?.downloadedAt ?? 0).getTime();
    const rightDate = new Date(right?.downloadedAt ?? 0).getTime();

    return rightDate - leftDate;
  });
}

function createEmptyLibraryProgress() {
  return {
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
  };
}

function createOfflineDatabaseUnavailableUiMessage() {
  return "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.";
}

export function sanitizeLibraryProgressTitle(value) {
  const normalizedValue =
    typeof value === "string" ? value.trim().replaceAll("\\", "/") : "";

  if (!normalizedValue) {
    return "";
  }

  if (
    /^[a-zA-Z]:\//.test(normalizedValue) ||
    normalizedValue.startsWith("//") ||
    normalizedValue.startsWith("file://") ||
    normalizedValue.startsWith("content://") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("/../")
  ) {
    return "Current track hidden for privacy.";
  }

  return normalizedValue;
}

function buildLibraryTransferSummary(progress) {
  const verifiedExistingCount = Number(progress?.verifiedExistingCount ?? 0);
  const downloadedCount = Number(progress?.downloadedCount ?? 0);
  const skippedCount = Number(progress?.skippedCount ?? 0);
  const failedCount = Number(progress?.failedCount ?? 0);

  return `Verified existing ${verifiedExistingCount}, newly downloaded ${downloadedCount}, skipped during this run ${skippedCount}, failed ${failedCount}.`;
}

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
  const [libraryStatus, setLibraryStatus] = useState(() => initialLibraryStatus);
  const [loading, setLoading] = useState(() =>
    initialLoading ?? initialSummary === null,
  );
  const [libraryLoading, setLibraryLoading] = useState(() =>
    initialLoading ?? initialLibraryStatus === null,
  );
  const [isLibraryDownloading, setIsLibraryDownloading] = useState(
    initialIsLibraryDownloading ?? fullLibraryRuntimeState.isRunning,
  );
  const [libraryProgress, setLibraryProgress] = useState(
    () => initialLibraryProgress ?? fullLibraryRuntimeState.progress ?? createEmptyLibraryProgress(),
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  useEffect(() => subscribeToAppModeChanges(setAppMode), []);

  useEffect(() => {
    return subscribeToFullLibraryDownloadState((runtimeState) => {
      if (!isMountedRef.current) {
        return;
      }

      setIsLibraryDownloading(runtimeState.isRunning);
      setLibraryProgress(runtimeState.progress ?? createEmptyLibraryProgress());
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

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
            lastSafeErrorMessage: "Could not load your PC library for offline download.",
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

  async function reloadOfflineData(nextMessage = "", nextMessageTone = "success") {
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
          : getSafeErrorMessage(error, "Unable to refresh downloaded playlists."),
      );
      setMessageTone("error");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

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
        lastSafeErrorMessage: "Could not load your PC library for offline download.",
      });
    } finally {
      if (isMountedRef.current) {
        setLibraryLoading(false);
      }
    }
  }

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
  const libraryTracksKnown = Number.isFinite(Number(libraryStatus?.totalLibraryTracks))
    ? Number(libraryStatus.totalLibraryTracks)
    : 0;
  const libraryDatabaseUnavailable =
    libraryStatus?.error === "offline_database_unavailable";
  const libraryUnavailable =
    libraryStatus?.error === "library_unavailable";

  async function handlePlayOffline(playlistId) {
    const playbackQueue = await buildOfflinePlaybackQueue(playlistId);

    if (!playbackQueue) {
      setMessage("Could not load this downloaded playlist for offline playback.");
      setMessageTone("error");
      return;
    }

    if (!playbackQueue.tracks.length) {
      setMessage("No playable offline audio files were found for this playlist.");
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

    setMessage(`Playing ${playbackQueue.playlistName || "downloaded playlist"} offline.`);
    setMessageTone("success");
  }

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
        nextMessage =
          `Cancelled - verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed ${result.failedCount}.`,
        nextTone = "warning";
      } else if (result.totalMissingTracks === 0) {
        nextMessage = result.totalLibraryTracks === 0
          ? "No tracks found in your PC library right now."
          : "All library tracks are already downloaded for offline use.";
        nextTone = "success";
      } else if (result.failedCount > 0) {
        nextMessage =
          `Verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed ${result.failedCount}.`,
        nextTone = "warning";
      } else {
        nextMessage =
          `Verified ${result.verifiedExistingCount ?? 0} existing, downloaded ${result.downloadedCount} new, skipped ${result.skippedCount}, failed 0.`,
        nextTone = "success";
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

          <div className="downloaded-page__summary-grid" aria-label="Offline storage summary">
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
              <span className="downloaded-page__summary-label">Storage type</span>
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
              <span className="downloaded-page__summary-label">Artwork size</span>
              <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
                {formatStorageSize(summary?.totalArtworkBytes ?? 0)}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Offline total</span>
              <span className="downloaded-page__summary-value">
                {formatStorageSize(summary?.totalBytes ?? 0)}
              </span>
            </div>
          </div>
        </header>

        <section className="downloaded-page__library-card" aria-labelledby="offline-library-title">
          <div className="downloaded-page__library-copy">
            <p className="downloaded-page__section-eyebrow">Offline Library</p>
            <h2 id="offline-library-title" className="downloaded-page__section-title">
              Full library download
            </h2>
            <p className="downloaded-page__state-text">
              Download your PC music library for Offline Mode browsing and playback.
            </p>
          </div>

          <div className="downloaded-page__summary-grid" aria-label="Offline library download summary">
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">PC library tracks</span>
              <span className="downloaded-page__summary-value">
                {libraryLoading
                  ? "..."
                  : libraryTracksKnown}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Already downloaded</span>
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
              <span className="downloaded-page__summary-label">New downloads</span>
              <span className="downloaded-page__summary-value">
                {isLibraryDownloading
                  ? Math.max(
                      libraryProgress.totalMissingTracks - libraryProgress.processedMissingTracks,
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
              <span className="downloaded-page__summary-label">Estimated size</span>
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
              Connect to your PC backend in LAN Mode to inspect the full library.
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
                {libraryProgress.processedMissingTracks} / {libraryProgress.totalMissingTracks} missing tracks processed.
                {" "}{buildLibraryTransferSummary(libraryProgress)}
                {" "}Fetched {formatStorageSize(libraryProgress.downloadedBytes)} so far.
              </p>
              {libraryProgress.currentTrackTitle ? (
                <p className="downloaded-page__warning-text">
                  Current track: {sanitizeLibraryProgressTitle(
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
              {isLibraryDownloading ? "Downloading library..." : "Download Full Library"}
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

        {message ? (
          <p
            className={`downloaded-page__message downloaded-page__message--${messageTone}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}

        {missingAudioWarning ? (
          <section className="downloaded-page__warning" role="alert">
            <p className="downloaded-page__warning-title">Missing offline audio files</p>
            <p className="downloaded-page__warning-text">{missingAudioWarning}</p>
          </section>
        ) : null}

        {loading && !summary ? (
          <section className="downloaded-page__state" aria-live="polite">
            <p className="downloaded-page__state-title">
              Loading offline storage...
            </p>
            <p className="downloaded-page__state-text">
              Reading downloaded playlist data from local offline storage.
            </p>
          </section>
        ) : null}

        {!loading && !storageAvailable ? (
          <section className="downloaded-page__state downloaded-page__state--unavailable">
            <p className="downloaded-page__state-title">
              Offline storage is unavailable in this browser.
            </p>
            <p className="downloaded-page__state-text">
              Local offline storage is unavailable or blocked on this device.
            </p>
          </section>
        ) : null}

        {!loading && storageAvailable && !hasPlaylists ? (
          <section className="downloaded-page__state downloaded-page__state--empty">
            <p className="downloaded-page__state-title">
              No downloaded playlists yet.
            </p>
            <p className="downloaded-page__state-text">
              Download a playlist from the playlist page or use Download Full Library in LAN Mode.
            </p>
          </section>
        ) : null}

        {!loading && storageAvailable && hasPlaylists ? (
          <section className="downloaded-page__content" aria-label="Downloaded playlists">
            <div className="downloaded-page__section-header">
              <div>
                <p className="downloaded-page__section-eyebrow">Stored playlists</p>
                <h2 className="downloaded-page__section-title">
                  Downloaded playlists
                </h2>
              </div>
              <button
                type="button"
                className="downloaded-page__button downloaded-page__button--danger"
                onClick={handleClearAll}
              >
                Clear All Downloads
              </button>
            </div>

            <div className="downloaded-page__playlist-grid">
              {playlists.map((playlist) => (
                <article
                  key={playlist.id}
                  className="downloaded-page__playlist-card"
                >
                  <div className="downloaded-page__playlist-copy">
                    <p className="downloaded-page__playlist-label">Playlist</p>
                    <h3 className="downloaded-page__playlist-name">
                      {playlist.name || "Untitled playlist"}
                    </h3>
                    <p className="downloaded-page__playlist-meta">
                      {playlist.totalTracks ?? 0} tracks
                    </p>
                    <p className="downloaded-page__playlist-meta">
                      Offline size {formatStorageSize(playlist.totalBytes ?? 0)}
                    </p>
                    <p className="downloaded-page__playlist-meta">
                      Downloaded {formatDownloadedDate(playlist.downloadedAt)}
                    </p>
                    <p className="downloaded-page__playlist-status">
                      Already downloaded for offline playback.
                    </p>
                  </div>

                  <div
                    className="downloaded-page__playlist-actions"
                    role="group"
                    aria-label={`Actions for ${playlist.name || "downloaded playlist"}`}
                  >
                    <button
                      type="button"
                      className="downloaded-page__button downloaded-page__button--secondary"
                      onClick={() => handlePlayOffline(playlist.id)}
                    >
                      Play Offline
                    </button>
                    <button
                      type="button"
                      className="downloaded-page__button downloaded-page__button--ghost-danger"
                      onClick={() => handleDeletePlaylist(playlist.id)}
                    >
                      Delete Download
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
