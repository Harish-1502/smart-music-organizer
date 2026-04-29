import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  scanLibrary,
  getScanStatus,
  clearLibrary,
} from "../api/libraryApi";
import ScanProgress from "../components/ScanProgress";
import ArtistList from "../components/ArtistList";
import AlbumList from "../components/AlbumList";
import LibraryViewTabs from "../components/LibraryViewTabs";
import useLibraryViews from "../hooks/useLibraryViews";
import useTrackBrowser from "../hooks/useTrackBrowser";
import TrackBrowser from "../components/TrackBrowser";
import { usePlayer } from "../context/PlayerContext";
import "../styles/library/LibraryPage.css";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const [folderPath, setFolderPath] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const trackBrowser = useTrackBrowser();
  
  const {
    viewMode,
    setViewMode,
    artists,
    artistsLoading,
    albums,
    albumsLoading,
    loadArtists,
    loadAlbums,
  } = useLibraryViews({setMessage: trackBrowser.setMessage,
  });
  
  function handleArtistClick(artistName) {
    trackBrowser.applyArtistClick(artistName);
    setViewMode("tracks");
  }

  function handleAlbumClick(albumName, artistName){
    trackBrowser.applyAlbumClick(albumName, artistName);
    setViewMode("tracks");
  }

  async function handleTrackPlay(track, trackIndex) {
    try {
      const queue = await trackBrowser.loadAllTracksForQueue();
      const startIndex = queue.findIndex((queueTrack) => queueTrack.id === track.id);

      playQueue(queue, startIndex >= 0 ? startIndex : trackIndex);
      navigate("/player");
    } catch (error) {
      // The hook already surfaces the error message for the page UI.
    }
  }

  async function handleScan() {
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

  async function deleteAllSong() {
    console.warn("[DEBUG deleteAllSong] clicked", {
      time: new Date().toISOString(),
    });
    setLoading(true);
    setStatus(null);
    trackBrowser.setMessage("");

    try {
      const latestDeleteStatus = await clearLibrary();
      setStatus(latestDeleteStatus);

      if (trackBrowser.page !== 1) {
        trackBrowser.setPage(1);
      } else {
        await trackBrowser.loadTracks(1);
      }

      if (viewMode === "artists") {
        await loadArtists();
      }

      trackBrowser.setMessage("Delete complete");
    } catch (error) {
      trackBrowser.setMessage(error.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

    async function handleRefresh() {
      trackBrowser.setMessage("");
      const latestStatus = await getScanStatus();
      setStatus(latestStatus);

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

  // DUBUG
  // console.log("Tracks State:", tracks);

  return (
    <main className="library-page" aria-labelledby="library-title">
      <div className="library-page__inner">
        <header className="library-page__hero">
          <div className="library-page__hero-panel">
            <div className="library-page__hero-copy">
              <p className="library-page__eyebrow">Library</p>
              <h1 id="library-title" className="library-page__title">
                Library Scanner
              </h1>
              <p className="library-page__subtitle">
                Scan your music folders, browse tracks, and jump between artists
                and albums fast.
              </p>
            </div>

            <div className="library-page__scan-controls">
              <label className="library-page__field">
                <span className="library-page__label">Music folder</span>
                <input
                  className="library-page__input"
                  type="text"
                  placeholder="Enter music folder path"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
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
                  onClick={deleteAllSong}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </header>

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
              mode="library"
              onPlayTrack={handleTrackPlay}
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
