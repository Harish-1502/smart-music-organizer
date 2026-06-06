import { useEffect, useState } from "react";
import {
  clearOfflineDownloads,
  deleteDownloadedPlaylist,
  getDownloadedPlaylists,
  getOfflineStorageSummary,
} from "../offline/offlineStorage";
import "../styles/DownloadedPage.css";

function formatStorageSize(totalBytes) {
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

function sortPlaylistsByDownloadedDate(playlists) {
  return [...playlists].sort((left, right) => {
    const leftDate = new Date(left?.downloadedAt ?? 0).getTime();
    const rightDate = new Date(right?.downloadedAt ?? 0).getTime();

    return rightDate - leftDate;
  });
}

export default function DownloadedPage() {
  const [summary, setSummary] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  useEffect(() => {
    let isMounted = true;

    async function loadOfflineData() {
      setLoading(true);
      setMessage("");
      setMessageTone("success");

      try {
        const [nextSummary, nextPlaylists] = await Promise.all([
          getOfflineStorageSummary(),
          getDownloadedPlaylists(),
        ]);

        if (!isMounted) {
          return;
        }

        setSummary(nextSummary);
        setPlaylists(sortPlaylistsByDownloadedDate(nextPlaylists));
      } catch {
        if (isMounted) {
          setSummary({
            available: false,
            playlistCount: 0,
            trackCount: 0,
            totalBytes: 0,
          });
          setPlaylists([]);
          setMessage("Unable to load downloaded playlists.");
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

  async function reloadOfflineData(nextMessage = "") {
    setLoading(true);
    setMessage(nextMessage);
    setMessageTone("success");

    try {
      const [nextSummary, nextPlaylists] = await Promise.all([
        getOfflineStorageSummary(),
        getDownloadedPlaylists(),
      ]);

      setSummary(nextSummary);
      setPlaylists(sortPlaylistsByDownloadedDate(nextPlaylists));
    } catch {
      setSummary({
        available: false,
        playlistCount: 0,
        trackCount: 0,
        totalBytes: 0,
      });
      setPlaylists([]);
      setMessage("Unable to refresh downloaded playlists.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlaylist(playlistId) {
    const confirmed = window.confirm("Delete this downloaded playlist?");

    if (!confirmed) {
      return;
    }

    const deleted = await deleteDownloadedPlaylist(playlistId);

    if (!deleted) {
      setMessage("Could not delete the downloaded playlist.");
      setMessageTone("error");
      return;
    }

    await reloadOfflineData("Downloaded playlist removed.");
  }

  async function handleClearAll() {
    const confirmed = window.confirm(
      "Clear all downloaded playlists and offline media?",
    );

    if (!confirmed) {
      return;
    }

    const cleared = await clearOfflineDownloads();

    if (!cleared) {
      setMessage("Could not clear offline downloads.");
      setMessageTone("error");
      return;
    }

    await reloadOfflineData("Offline downloads cleared.");
  }

  const hasPlaylists = playlists.length > 0;
  const storageAvailable = Boolean(summary?.available);

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
              Review what is already stored in this browser for future offline
              listening steps. No API token or PC file path is shown here.
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
              <span className="downloaded-page__summary-label">Tracks</span>
              <span className="downloaded-page__summary-value">
                {summary?.trackCount ?? 0}
              </span>
            </div>
            <div className="downloaded-page__summary-card">
              <span className="downloaded-page__summary-label">Storage used</span>
              <span className="downloaded-page__summary-value">
                {formatStorageSize(summary?.totalBytes ?? 0)}
              </span>
            </div>
          </div>
        </header>

        {message ? (
          <p
            className={`downloaded-page__message downloaded-page__message--${messageTone}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}

        {loading && !summary ? (
          <section className="downloaded-page__state" aria-live="polite">
            <p className="downloaded-page__state-title">
              Loading offline storage...
            </p>
            <p className="downloaded-page__state-text">
              Reading downloaded playlist data from this browser.
            </p>
          </section>
        ) : null}

        {!loading && !storageAvailable ? (
          <section className="downloaded-page__state downloaded-page__state--unavailable">
            <p className="downloaded-page__state-title">
              Offline storage is unavailable in this browser.
            </p>
            <p className="downloaded-page__state-text">
              IndexedDB is missing or blocked, so downloaded playlists cannot be
              read here.
            </p>
          </section>
        ) : null}

        {!loading && storageAvailable && !hasPlaylists ? (
          <section className="downloaded-page__state downloaded-page__state--empty">
            <p className="downloaded-page__state-title">
              No downloaded playlists yet.
            </p>
            <p className="downloaded-page__state-text">
              In the next step, you&apos;ll be able to download playlists from
              the playlist page for offline playback.
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
                      Estimated size {formatStorageSize(playlist.totalBytes ?? 0)}
                    </p>
                    <p className="downloaded-page__playlist-meta">
                      Downloaded {formatDownloadedDate(playlist.downloadedAt)}
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
                      disabled
                    >
                      Play Offline
                    </button>
                    <button
                      type="button"
                      className="downloaded-page__button downloaded-page__button--ghost-danger"
                      onClick={() => handleDeletePlaylist(playlist.id)}
                    >
                      Delete
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
