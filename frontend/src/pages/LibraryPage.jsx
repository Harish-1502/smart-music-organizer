import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAppMode,
  isOfflineMode,
  subscribeToAppModeChanges,
} from "../appMode/appMode";
import {
  CLEAR_LIBRARY_CONFIRMATION,
  clearLibrary,
  getScanStatus,
  scanLibrary,
} from "../api/libraryApi";
import AlbumList from "../components/AlbumList";
import ArtistList from "../components/ArtistList";
import LibraryViewTabs from "../components/LibraryViewTabs";
import ScanProgress from "../components/ScanProgress";
import TrackBrowser from "../components/TrackBrowser";
import { usePlayer } from "../context/PlayerContext";
import useLibraryViews from "../hooks/useLibraryViews";
import useTrackBrowser from "../hooks/useTrackBrowser";
import { getLibrarySourceForMode } from "../library/librarySource";
import { isDemoMode } from "../utils/demoMode";
import "../styles/library/LibraryPage.css";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const [appMode, setAppMode] = useState(() => getAppMode());
  const [folderPath, setFolderPath] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const offlineModeEnabled = isOfflineMode(appMode);
  const librarySource = getLibrarySourceForMode(appMode);
  const trackBrowser = useTrackBrowser(librarySource);
  const demoModeEnabled = isDemoMode();
  const clearConfirmationMatches =
    clearConfirmText === CLEAR_LIBRARY_CONFIRMATION;

  const {
    viewMode,
    setViewMode,
    artists,
    artistsLoading,
    albums,
    albumsLoading,
    loadArtists,
    loadAlbums,
  } = useLibraryViews({
    setMessage: trackBrowser.setMessage,
    source: librarySource,
  });

  useEffect(() => subscribeToAppModeChanges(setAppMode), []);

  useEffect(() => {
    if (!offlineModeEnabled) {
      return;
    }

    setStatus(null);
    setClearConfirmOpen(false);
    setClearConfirmText("");
  }, [offlineModeEnabled]);

  function handleArtistClick(artistName) {
    trackBrowser.applyArtistClick(artistName);
    setViewMode("tracks");
  }

  function handleAlbumClick(albumName, artistName) {
    trackBrowser.applyAlbumClick(albumName, artistName);
    setViewMode("tracks");
  }

  async function handleTrackPlay(track, trackIndex) {
    try {
      const queue = await trackBrowser.loadAllTracksForQueue();
      const startIndex = queue.findIndex((queueTrack) => queueTrack.id === track.id);

      playQueue(queue, startIndex >= 0 ? startIndex : trackIndex);
      navigate("/player");
    } catch {
      // The hook already surfaces the error message for the page UI.
    }
  }

  async function handleScan() {
    if (offlineModeEnabled) {
      return;
    }

    setLoading(true);
    setStatus(null);
    trackBrowser.setMessage("");

    try {
      const scanResponse = await scanLibrary(folderPath);
      const latestStatus = await getScanStatus();
      setStatus(latestStatus);

      if (trackBrowser.page !== 1) {
        trackBrowser.setPage(1);
      } else {
        await trackBrowser.loadTracks(1);
      }

      if (viewMode === "artists") {
        await loadArtists();
      }

      trackBrowser.setMessage(scanResponse.message);
    } catch (error) {
      trackBrowser.setMessage(error.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  function openClearConfirmation() {
    if (offlineModeEnabled) {
      return;
    }

    setClearConfirmText("");
    setClearConfirmOpen(true);
  }

  function closeClearConfirmation() {
    if (loading) {
      return;
    }

    setClearConfirmOpen(false);
    setClearConfirmText("");
  }

  async function handleClearLibrary(event) {
    event.preventDefault();

    if (offlineModeEnabled) {
      return;
    }

    if (!clearConfirmationMatches) {
      trackBrowser.setMessage("Type CLEAR LIBRARY to confirm.");
      return;
    }

    setLoading(true);
    setStatus(null);
    trackBrowser.setMessage("");

    try {
      const latestDeleteStatus = await clearLibrary(clearConfirmText);
      setStatus(latestDeleteStatus);
      setClearConfirmOpen(false);
      setClearConfirmText("");

      if (trackBrowser.page !== 1) {
        trackBrowser.setPage(1);
      } else {
        await trackBrowser.loadTracks(1);
      }

      if (viewMode === "artists") {
        await loadArtists();
      }

      trackBrowser.setMessage("Library cleared");
    } catch (error) {
      trackBrowser.setMessage(error.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    trackBrowser.setMessage("");

    if (!offlineModeEnabled) {
      const latestStatus = await getScanStatus();
      setStatus(latestStatus);
    } else {
      setStatus(null);
    }

    if (viewMode === "tracks") {
      if (trackBrowser.page !== 1) {
        trackBrowser.setPage(1);
      } else {
        await trackBrowser.loadTracks(1);
      }
    } else if (viewMode === "artists") {
      await loadArtists();
    } else if (viewMode === "albums") {
      await loadAlbums();
    }
  }

  return (
    <main className="library-page" aria-labelledby="library-title">
      <div className="library-page__inner">
        <header className="library-page__hero">
          <div className="library-page__hero-panel">
            <div className="library-page__hero-copy">
              <p className="library-page__eyebrow">Library</p>
              <h1 id="library-title" className="library-page__title">
                {offlineModeEnabled ? "Offline Library" : "Library Scanner"}
              </h1>
              <p className="library-page__subtitle">
                {offlineModeEnabled
                  ? "Browse downloaded tracks stored on this device. PC-only actions like scan folders are disabled in Offline Mode."
                  : "Scan your music folders, browse tracks, and jump between artists and albums fast."}
              </p>
            </div>

            {offlineModeEnabled ? (
              <div className="library-page__mode-card" role="note">
                <p className="library-page__mode-badge">Offline Mode</p>
                <p className="library-page__mode-copy">
                  This view reads downloaded tracks from local device storage only.
                  Scan folders and clear-library actions are available in LAN Mode only.
                </p>
              </div>
            ) : (
              <div className="library-page__scan-controls">
                <label className="library-page__field">
                  <span className="library-page__label">Music folder</span>
                  <input
                    className="library-page__input"
                    type={demoModeEnabled ? "password" : "text"}
                    placeholder={
                      demoModeEnabled
                        ? "Path hidden in demo mode"
                        : "Enter music folder path"
                    }
                    value={folderPath}
                    onChange={(event) => setFolderPath(event.target.value)}
                  />
                </label>

                <div className="library-page__scan-actions">
                  <button
                    type="button"
                    className="library-page__button library-page__button--primary"
                    onClick={handleScan}
                    disabled={loading || !folderPath.trim()}
                  >
                    {loading ? "Scanning..." : "Scan Library"}
                  </button>

                  <button
                    type="button"
                    className="library-page__button library-page__button--danger"
                    onClick={openClearConfirmation}
                    disabled={loading}
                  >
                    Clear Library
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {clearConfirmOpen && (
          <div
            className="clear-library-modal__overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeClearConfirmation();
              }
            }}
          >
            <form
              className="clear-library-modal__dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-library-modal-title"
              onSubmit={handleClearLibrary}
            >
              <div className="clear-library-modal__header">
                <h2
                  id="clear-library-modal-title"
                  className="clear-library-modal__title"
                >
                  Clear Library
                </h2>
                <p className="clear-library-modal__subtitle">
                  This removes tracks and track relationships from the app
                  database. Music files on disk are not deleted.
                </p>
              </div>

              <label className="clear-library-modal__field">
                <span className="clear-library-modal__label">
                  Type {CLEAR_LIBRARY_CONFIRMATION}
                </span>
                <input
                  className="clear-library-modal__input"
                  value={clearConfirmText}
                  onChange={(event) => setClearConfirmText(event.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <div className="clear-library-modal__actions">
                <button
                  type="button"
                  className="clear-library-modal__button clear-library-modal__button--secondary"
                  onClick={closeClearConfirmation}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="clear-library-modal__button clear-library-modal__button--danger"
                  disabled={loading || !clearConfirmationMatches}
                >
                  {loading ? "Clearing..." : "Clear Library"}
                </button>
              </div>
            </form>
          </div>
        )}

        {trackBrowser.message && (
          <p className="library-page__message" role="alert">
            {trackBrowser.message}
          </p>
        )}

        <ScanProgress status={status} />

        <section className="library-page__section" aria-label="Library browser">
          <LibraryViewTabs
            onChangeView={setViewMode}
            onRefresh={handleRefresh}
            refreshDisabled={loading || trackBrowser.tracksLoading}
          />

          {viewMode === "tracks" && (
            <TrackBrowser
              browser={trackBrowser}
              mode={offlineModeEnabled ? "offline" : "library"}
              onPlayTrack={handleTrackPlay}
              emptyStateMessage={
                offlineModeEnabled
                  ? "No downloaded tracks are available on this device yet."
                  : "No tracks found."
              }
            />
          )}

          {viewMode === "artists" && (
            <>
              <h2 className="library-page__section-title">Artists</h2>

              {artistsLoading ? (
                <p className="library-page__state">Loading artists...</p>
              ) : artists.length === 0 ? (
                <p className="library-page__state">No artists found.</p>
              ) : (
                <ArtistList artists={artists} onArtistClick={handleArtistClick} />
              )}
            </>
          )}

          {viewMode === "albums" && (
            <>
              <h2 className="library-page__section-title">Albums</h2>

              {albumsLoading ? (
                <p className="library-page__state">Loading albums...</p>
              ) : albums.length === 0 ? (
                <p className="library-page__state">No albums found.</p>
              ) : (
                <AlbumList albums={albums} onAlbumClick={handleAlbumClick} />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
