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

  async function loadTracks() {
    setTracksLoading(true);
    try {
      // console.log("Called");
      const data = await getTracks();
       console.log("TRACKS FROM API:", data);
      setTracks(data);
    } catch (error) {
      console.error("LOAD TRACKS ERROR:", error);
      setMessage(error.message);
    } finally {
      setTracksLoading(false);
    }
  }

  useEffect(() => {
    
    loadTracks();
  }, []);

  async function handleScan() {
    setLoading(true);
    setStatus(null);
    setMessage("");

    try {
      await scanLibrary(folderPath);
      const latestStatus = await getScanStatus();
      setStatus(latestStatus);
      await loadTracks();
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
      await loadTracks();
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

      <button onClick={deleteAllSong} disabled={loading} style={{ marginLeft: "8px" }}>
        Delete
      </button>

      {message && <p>{message}</p>}

      <ScanProgress status={status} />

      <hr style={{ margin: "24px 0" }} />

      <h2>Tracks</h2>
      {tracksLoading ? <p>Loading tracks...</p> : <TrackTable tracks={tracks} />}
    </div>
  );
}