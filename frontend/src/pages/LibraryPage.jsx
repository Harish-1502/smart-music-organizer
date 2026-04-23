import { useEffect, useState } from "react";
import {
  scanLibrary,
  getScanStatus,
  clearLibrary,
  getTracks,
} from "../api/libraryApi";
import ScanProgress from "../components/ScanProgress";
import TrackTable from "../components/TrackTable";
import ArtistList from "../components/ArtistList";
import AlbumList from "../components/AlbumList";
import EditTrackModal from "../components/EditTrackModal";
import TrackSortControls from "../components/TrackSortControls";
import LibraryViewTabs from "../components/LibraryViewTabs";
import TrackFilterControls from "../components/TrackFilterControls";
import useTrackEdit from "../hooks/useTrackEdit";
import useTrackViewControls from "../hooks/useTrackViewControls";
import useLibraryViews from "../hooks/useLibraryViews";

export default function LibraryPage() {
  const [folderPath, setFolderPath] = useState("");
  const [status, setStatus] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [order, setOrder] = useState("asc");
  const [sortBy, setSortBy] = useState("title");
  const [extensionFilter, setExtensionFilter] = useState("");

  async function loadTracks(
    currentPage = page,
    currentSearch = appliedSearch,
    currentSortBy = sortBy,
    currentOrder = order,
    currentArtist = artistFilter,
    currentExactArtist = exactArtistFilter,
    currentExactAlbum = exactAlbumFilter,
    currentAlbum = albumFilter,
    currentExtension = extensionFilter
  ) 
  {
    setTracksLoading(true);
    // DEBUG
    // console.log("Current Artist Filter:", currentArtist);
    // console.log("Current Exact Artist Filter:", currentExactArtist);
    try {
      const data = await getTracks(
        currentPage,
        pageSize,
        currentSearch,
        currentSortBy,
        currentOrder,
        currentArtist,
        currentExactArtist,
        currentAlbum,
        currentExactAlbum,
        currentExtension
      );

      // DEBUG
      // console.log("TRACKS FROM API:", data);

      setTracks(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalItems(data.total_items || 0);
    } catch (error) {
      console.error("LOAD TRACKS ERROR:", error);
      setMessage(error.message || "Failed to load tracks");
    } finally {
      setTracksLoading(false);
    }
  }

  const {
    viewMode,
    setViewMode,
    artists,
    artistsLoading,
    albums,
    albumsLoading,
    loadArtists,
    loadAlbums,
  } = useLibraryViews({ setMessage });

  async function handleScan() {
    setLoading(true);
    setStatus(null);
    setMessage("");

    try {
      const scanResponse = await scanLibrary(folderPath);
      const latestStatus = await getScanStatus();
      setStatus(latestStatus);

      if (page !== 1) {
        setPage(1);
      } else {
        await loadTracks(1);
      }

      if (viewMode === "artists") {
        await loadArtists();
      }

      setMessage(scanResponse.message);
    } catch (error) {
      setMessage(error.message || "Scan failed");
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
    setMessage("");

    try {
      const latestDeleteStatus = await clearLibrary();
      setStatus(latestDeleteStatus);

      if (page !== 1) {
        setPage(1);
      } else {
        await loadTracks(1);
      }

      if (viewMode === "artists") {
        await loadArtists();
      }

      setMessage("Delete complete");
    } catch (error) {
      setMessage(error.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  const {
    artistFilter,
    albumFilter,
    exactArtistFilter,
    exactAlbumFilter,
    setArtistFilter,
    setAlbumFilter,
    setExactArtistFilter,
    setExactAlbumFilter,
    handleArtistClick,
    handleAlbumClick,
    clearAllFilters,
    handleRefresh,
  } = useTrackViewControls({
      setSearch,
      setAppliedSearch,
      setExtensionFilter,
      setSortBy,
      setOrder,
      setPage,
      setMessage,
      setStatus,
      setViewMode,
      loadTracks,
      loadArtists,
      loadAlbums,
      viewMode,
      page
    });

    const {
      showModal,
      editForm,
      handleEditTrack,
      handleFormChange,
      handleCancelEdit,
      handleSaveEdit,
    } = useTrackEdit({ loadTracks, setMessage });
  
  useEffect(() => {
    loadTracks();
  }, [page, appliedSearch, sortBy, order, artistFilter, albumFilter, exactArtistFilter, exactAlbumFilter, extensionFilter]);

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

      {message && <p>{message}</p>}

      <ScanProgress status={status} />

      <hr style={{ margin: "24px 0" }} />

      <LibraryViewTabs
        onChangeView={setViewMode}
        onRefresh={handleRefresh}
        refreshDisabled={loading || tracksLoading}
      />

      {viewMode === "tracks" && (
        <>
          <h2>Tracks</h2>

          <TrackSortControls
            search={search}
            onSearchChange={setSearch}
            setAppliedSearch={setAppliedSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            order={order}
            onOrderChange={setOrder}
            setPage={setPage}
          />

          <TrackFilterControls
            artistFilter={artistFilter}
            albumFilter={albumFilter}
            extensionFilter={extensionFilter}
            setPage={setPage}
            setArtistFilter={setArtistFilter}
            setAlbumFilter={setAlbumFilter}
            setExtensionFilter={setExtensionFilter}
            clearAllFilters={clearAllFilters}
          />

          <p>Total Tracks: {totalItems}</p>

          {tracksLoading ? (
            <p>Loading tracks...</p>
          ) : tracks.length === 0 ? (
            <p>No tracks found.</p>
          ) : (
            <>
              <TrackTable tracks={tracks} onEdit={handleEditTrack} />
              <EditTrackModal
                isOpen={showModal}
                formData={editForm}
                onChange={handleFormChange}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
              />
              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>

                <span>
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() =>
                    setPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
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