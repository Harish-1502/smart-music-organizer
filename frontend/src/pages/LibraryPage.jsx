import { useEffect, useState } from "react";
import {
  scanLibrary,
  getScanStatus,
  clearLibrary,
  getTracks,
} from "../api/libraryApi";
import ScanProgress from "../components/ScanProgress";
import TrackTable from "../components/TrackTable";

export default function LibraryPage() {
  const [folderPath, setFolderPath] = useState("");
  const [status, setStatus] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("");
  const [order, setOrder] = useState("asc")
  const [sortBy, setSortBy] = useState("title")

  async function loadTracks(
    currentPage = page, 
    currentSearch = appliedSearch,
    currentSortBy = sortBy,
    currentOrder = order
  ) {
    setTracksLoading(true);
    try {
      const data = await getTracks(
        currentPage, 
        pageSize, 
        currentSearch,
        currentOrder,
        currentSortBy
      );
      console.log("TRACKS FROM API:", data);

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

  useEffect(() => { 
    loadTracks(page,appliedSearch, sortBy, order);
  }, [page, appliedSearch, order, sortBy]);

  async function handleScan() {
    setLoading(true);
    setStatus(null);
    setMessage("");

    try {
      await scanLibrary(folderPath);
      const latestStatus = await getScanStatus();

      setStatus(latestStatus);
      if (page !== 1) {
        setPage(1);
      } else {
        await loadTracks(1);
      }

      setMessage("Scan completed successfully");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteAllSong() {
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

      setMessage("Delete complete");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

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

      <h2>Tracks</h2>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by title, artist, or album"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "300px",
            padding: "8px",
            marginRight: "8px",
          }}
        />

        <button
          onClick={() => {
            setPage(1);
            setAppliedSearch(search);
          }}
        >
          Search
        </button>

        <button
          onClick={() => {
            setSearch("");
            setAppliedSearch("");
            setPage(1);
          }}
          style={{ marginLeft: "8px" }}
        >
          Clear Search
        </button>
      </div>

      <div style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
        <label>Sort by:</label>

        <select
          value={sortBy}
          onChange={(e) => {
            setPage(1);
            setSortBy(e.target.value);
          }}
        >
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="album">Album</option>
          <option value="duration">Duration</option>
        </select>

        <select
          value={order}
          onChange={(e) => {
            setPage(1);
            setOrder(e.target.value);
          }}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      <p>Total Tracks: {totalItems}</p>

      {tracksLoading ? (
        <p>Loading tracks...</p>
      ) : tracks.length === 0 ? (
        <p>No tracks found.</p>
      ) : (
        <>
          <TrackTable tracks={tracks} />

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
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}