import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAppMode,
  isOfflineMode,
  subscribeToAppModeChanges,
} from "../../../appMode/appMode";
import PlaylistTrackRow from "../components/PlaylistTrackRow";
import AddTracksModal from "../components/AddTracksModal";
import ReorderTracksModal from "../components/ReorderTracksModal";
import { usePlayer } from "../../../context/PlayerContext";
import { downloadPlaylistForOffline } from "../../../offline/downloadPlaylist";
import { hasOfflinePlaylist } from "../../../offline/mobileOfflineRepository";
import { getPlaylistSourceForMode } from "../../../playlists/playlistSource";
import "../../../styles/PlaylistDetailPage.css";

function formatDownloadBytes(totalBytes) {
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

export default function PlaylistDetailPage({
  initialAppMode = null,
  initialPlaylist = null,
  initialLoading = null,
  initialMessage = "",
  initialDownloaded = false,
  initialCheckingDownloadStatus = null,
  sourceOverride = null,
}) {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const downloadAbortRef = useRef(null);
  const [appMode, setAppMode] = useState(() => initialAppMode ?? getAppMode());
  const offlineModeEnabled = isOfflineMode(appMode);
  const playlistSource =
    sourceOverride ?? getPlaylistSourceForMode(initialAppMode ?? appMode);

  const [playlist, setPlaylist] = useState(() => initialPlaylist);
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [loading, setLoading] = useState(() =>
    initialLoading ?? initialPlaylist === null,
  );
  const [message, setMessage] = useState(() => initialMessage);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(() =>
    offlineModeEnabled ? true : initialDownloaded,
  );
  const [checkingDownloadStatus, setCheckingDownloadStatus] = useState(() =>
    initialCheckingDownloadStatus ?? !offlineModeEnabled,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [downloadMessageTone, setDownloadMessageTone] = useState("success");
  const [downloadProgress, setDownloadProgress] = useState({
    totalTracks: 0,
    completedTracks: 0,
    failedTracks: 0,
    processedTracks: 0,
    downloadedBytes: 0,
    currentTrackTitle: "",
  });

  useEffect(() => subscribeToAppModeChanges(setAppMode), []);

  useEffect(() => {
    loadPlaylist();
  }, [playlistId, playlistSource]);

  useEffect(() => {
    let isMounted = true;

    async function loadDownloadStatus() {
      if (offlineModeEnabled) {
        if (isMounted) {
          setIsDownloaded(true);
          setCheckingDownloadStatus(false);
        }
        return;
      }

      setCheckingDownloadStatus(true);

      try {
        const downloaded = await hasOfflinePlaylist(playlistId);

        if (isMounted) {
          setIsDownloaded(downloaded);
        }
      } finally {
        if (isMounted) {
          setCheckingDownloadStatus(false);
        }
      }
    }

    loadDownloadStatus();

    return () => {
      isMounted = false;
    };
  }, [offlineModeEnabled, playlistId]);

  useEffect(() => {
    return () => {
      downloadAbortRef.current?.abort();
    };
  }, []);

  async function loadPlaylist() {
    setLoading(true);
    setMessage("");

    try {
      const data = await playlistSource.getPlaylistDetail(playlistId);

      if (!data) {
        setPlaylist(null);
        setMessage("Playlist not found.");
        return;
      }

      setPlaylist(data);
    } catch {
      setMessage("Failed to load playlist.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveTrack(playlistTrackId) {
    if (!playlistSource.supportsTrackRemoval) {
      return;
    }

    try {
      await playlistSource.removeTrackFromPlaylist(playlistId, playlistTrackId);

      setPlaylist((prev) => ({
        ...prev,
        tracks: prev.tracks.filter(
          (track) => track.playlist_track_id !== playlistTrackId,
        ),
      }));
    } catch {
      setMessage("Failed to remove track.");
    }
  }

  async function handleTrackPlay(startIndex) {
    if (!playlist?.tracks?.length) return;

    if (offlineModeEnabled) {
      const playbackQueue = await playlistSource.buildPlaybackQueue(playlistId);

      if (!playbackQueue?.tracks?.length) {
        setMessage("No playable offline audio files were found for this playlist.");
        return;
      }

      const selectedTrack = playlist.tracks[startIndex];
      const selectedTrackId = selectedTrack?.track_id ?? selectedTrack?.id ?? null;
      const queueStartIndex = playbackQueue.tracks.findIndex(
        (track) => (track.track_id ?? track.id) === selectedTrackId,
      );

      if (queueStartIndex < 0) {
        setMessage(
          "This downloaded track is missing local audio and cannot be played offline.",
        );
        return;
      }

      playQueue(playbackQueue.tracks, queueStartIndex);

      if (playbackQueue.missingTrackIds.length > 0) {
        setMessage(
          `Playing offline with ${playbackQueue.tracks.length} tracks. ${playbackQueue.missingTrackIds.length} missing files were skipped.`,
        );
      } else {
        setMessage("");
      }

      navigate("/player");
      return;
    }

    playQueue(playlist.tracks, startIndex);
    navigate("/player");
  }

  async function handleDownloadForOffline() {
    if (!playlist || !playlist.tracks?.length || isDownloading || offlineModeEnabled) {
      return;
    }

    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setIsDownloading(true);
    setDownloadMessage("");
    setDownloadMessageTone("success");
    setDownloadProgress({
      totalTracks: playlist.tracks.length,
      completedTracks: 0,
      failedTracks: 0,
      processedTracks: 0,
      downloadedBytes: 0,
      currentTrackTitle: "",
    });

    try {
      const result = await downloadPlaylistForOffline({
        playlist,
        signal: controller.signal,
        onProgress: setDownloadProgress,
      });

      if (!result.savedPlaylist) {
        setDownloadMessage(
          result.failedTracks > 0
            ? "No tracks could be downloaded for offline use."
            : "This playlist has no tracks available to download yet.",
        );
        setDownloadMessageTone("error");
        return;
      }

      setIsDownloaded(true);

      if (result.failedTracks > 0) {
        setDownloadMessage(
          `Downloaded ${result.completedTracks} of ${result.totalTracks} tracks. ${result.failedTracks} failed.`,
        );
        setDownloadMessageTone("warning");
      } else {
        setDownloadMessage(
          `Downloaded ${result.completedTracks} tracks for offline use.`,
        );
        setDownloadMessageTone("success");
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setDownloadMessage("Offline download cancelled.");
        setDownloadMessageTone("warning");
      } else {
        setDownloadMessage("Could not download this playlist for offline use.");
        setDownloadMessageTone("error");
      }
    } finally {
      setIsDownloading(false);
      downloadAbortRef.current = null;
    }
  }

  function handleCancelDownload() {
    downloadAbortRef.current?.abort();
  }

  if (loading) {
    return (
      <main className="playlist-detail-page">
        <div className="playlist-detail-page__inner">
          <div className="playlist-detail-page__state-card" aria-live="polite">
            <p className="playlist-detail-page__state-title">Loading playlist...</p>
            <p className="playlist-detail-page__state-text">
              Pulling in tracks and playlist details.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!playlist) {
    return (
      <main className="playlist-detail-page">
        <div className="playlist-detail-page__inner">
          <div className="playlist-detail-page__state-card" role="status">
            <p className="playlist-detail-page__state-title">Playlist unavailable</p>
            <p className="playlist-detail-page__state-text">
              {message || "Playlist not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className="playlist-detail-page"
        aria-labelledby="playlist-detail-title"
      >
        <div className="playlist-detail-page__inner">
          <header className="playlist-detail-page__hero">
            <div className="playlist-detail-page__hero-panel">
              <div className="playlist-detail-page__hero-header">
                <div className="playlist-detail-page__hero-copy">
                  <p className="playlist-detail-page__eyebrow">Playlist</p>
                  <h1
                    id="playlist-detail-title"
                    className="playlist-detail-page__title"
                  >
                    {playlist.name}
                  </h1>
                  {offlineModeEnabled ? (
                    <p className="playlist-detail-page__offline-badge">Offline Mode</p>
                  ) : null}
                </div>

                <div
                  className="playlist-detail-page__hero-actions"
                  role="group"
                  aria-label={`Actions for ${playlist.name}`}
                >
                  {!offlineModeEnabled ? (
                    <>
                      <button
                        type="button"
                        className="playlist-detail-page__button playlist-detail-page__button--offline"
                        onClick={handleDownloadForOffline}
                        disabled={
                          checkingDownloadStatus ||
                          isDownloading ||
                          isDownloaded ||
                          playlist.tracks.length === 0
                        }
                      >
                        {checkingDownloadStatus
                          ? "Checking offline status..."
                          : isDownloaded
                            ? "Downloaded"
                            : isDownloading
                              ? `Downloading ${downloadProgress.processedTracks}/${downloadProgress.totalTracks || playlist.tracks.length}`
                              : "Download for offline"}
                      </button>
                      <button
                        type="button"
                        className="playlist-detail-page__button playlist-detail-page__button--primary"
                        onClick={() => setShowAddTracksModal(true)}
                      >
                        Add Tracks
                      </button>
                      <button
                        type="button"
                        className="playlist-detail-page__button playlist-detail-page__button--secondary"
                        onClick={() => setShowReorderModal(true)}
                      >
                        Reorder Tracks
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/downloaded"
                      className="playlist-detail-page__button playlist-detail-page__button--secondary playlist-detail-page__button-link"
                    >
                      Manage Downloads
                    </Link>
                  )}
                  {!offlineModeEnabled && isDownloading ? (
                    <button
                      type="button"
                      className="playlist-detail-page__button playlist-detail-page__button--danger"
                      onClick={handleCancelDownload}
                    >
                      Cancel Download
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className="playlist-detail-page__hero-stats"
                aria-label="Playlist summary"
              >
                <div className="playlist-detail-page__hero-stat">
                  <span className="playlist-detail-page__hero-stat-value">
                    {playlist.tracks.length}
                  </span>
                  <span className="playlist-detail-page__hero-stat-label">
                    {offlineModeEnabled ? "Offline tracks" : "Tracks in playlist"}
                  </span>
                </div>
              </div>

              {isDownloading ? (
                <div
                  className="playlist-detail-page__download-card"
                  aria-live="polite"
                >
                  <p className="playlist-detail-page__download-title">
                    Downloading for offline
                  </p>
                  <p className="playlist-detail-page__download-text">
                    {downloadProgress.completedTracks} of{" "}
                    {downloadProgress.totalTracks || playlist.tracks.length} tracks
                    saved. {downloadProgress.failedTracks} failed.{" "}
                    {formatDownloadBytes(downloadProgress.downloadedBytes)} fetched.
                  </p>
                  {downloadProgress.currentTrackTitle ? (
                    <p className="playlist-detail-page__download-meta">
                      Current track: {downloadProgress.currentTrackTitle}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          {message && (
            <p className="playlist-detail-page__message" role="alert">
              {message}
            </p>
          )}

          {downloadMessage ? (
            <p
              className={`playlist-detail-page__message playlist-detail-page__message--${downloadMessageTone}`}
              role={downloadMessageTone === "error" ? "alert" : "status"}
            >
              {downloadMessage}
            </p>
          ) : null}

          <section
            className="playlist-detail-page__section"
            aria-labelledby="playlist-tracks-title"
          >
            <div className="playlist-detail-page__section-header">
              <span
                className="playlist-detail-page__section-count"
                aria-label={`${playlist.tracks.length} tracks`}
              >
                {playlist.tracks.length} total
              </span>
            </div>

            {playlist.tracks.length === 0 ? (
              <div className="playlist-detail-page__empty-state">
                <p className="playlist-detail-page__empty-title">
                  This playlist is empty
                </p>
                <p className="playlist-detail-page__empty-text">
                  {offlineModeEnabled
                    ? "No downloaded tracks are available in this offline playlist yet."
                    : "Add tracks to start building your next listening run."}
                </p>
              </div>
            ) : (
              <div className="playlist-detail-page__track-list" role="list">
                {playlist.tracks.map((track, index) => (
                  <PlaylistTrackRow
                    key={track.playlist_track_id}
                    track={track}
                    onRemove={handleRemoveTrack}
                    canRemove={!offlineModeEnabled}
                    onPlay={() => handleTrackPlay(index)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {!offlineModeEnabled && showAddTracksModal && (
        <AddTracksModal
          playlistId={playlistId}
          onClose={() => setShowAddTracksModal(false)}
          onTracksAdded={loadPlaylist}
        />
      )}

      {!offlineModeEnabled && showReorderModal && (
        <ReorderTracksModal
          playlistId={playlistId}
          tracks={playlist.tracks}
          onClose={() => setShowReorderModal(false)}
          onReorder={loadPlaylist}
        />
      )}
    </>
  );
}
