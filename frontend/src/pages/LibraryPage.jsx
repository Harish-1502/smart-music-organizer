import { useState } from "react";
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

export default function LibraryPage() {
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
    <div style={{ padding: "24px" }}>
      <h1>Library Scanner</h1>

      <input
        type="text"
        placeholder="Enter music folder path"
        value={folderPath}
        onChange={(e) => setFolderPath(e.target.value)}
        style={{
          width: "300px",
          padding: "8px",
          marginRight: "8px",
        }}
      />

      <button onClick={handleScan} disabled={loading || !folderPath.trim()}>
        {loading ? "Scanning..." : "Scan Library"}
      </button>

      <button
        onClick={deleteAllSong}
        disabled={loading}
        style={{ marginLeft: "8px" }}
      >
        Delete
      </button>

      {trackBrowser.message && <p>{trackBrowser.message}</p>}

      <ScanProgress status={status} />

      <hr style={{ margin: "24px 0" }} />

      <LibraryViewTabs
        onChangeView={setViewMode}
        onRefresh={handleRefresh}
        refreshDisabled={loading || trackBrowser.tracksLoading}
      />

      {viewMode === "tracks" && (
        <TrackBrowser browser={trackBrowser} mode="library" />
      )} 

      {viewMode === "artists" && (
        <>
          <h2>Artists</h2>

          {artistsLoading ? (
            <p>Loading artists...</p>
          ) : artists.length === 0 ? (
            <p>No artists found.</p>
          ) : (
            <ArtistList artists={artists} onArtistClick={handleArtistClick} />
          )}
        </>
      )}

      {viewMode === "albums" && (
        <>
          <h2>Albums</h2>

          {albumsLoading ? (
            <p>Loading albums...</p>
          ) : albums.length === 0 ? (
            <p>No albums found.</p>
          ) : (
            <AlbumList albums={albums} onAlbumClick={handleAlbumClick} />
          )}
        </>
      )}
    </div>
  );
}