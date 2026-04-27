import { useEffect, useState } from "react";
import { getTracks } from "../../api/libraryApi";
import { addTrackToPlaylist } from "../../api/playlistApi";

export default function AddTracksModal({ playlistId, onClose, onTracksAdded }) {
  const [tracks, setTracks] = useState([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTracks();
  }, []);

  async function loadTracks() {
    const cleanSearch = search?.trim() || ""
    try {
      const data = await getTracks({
        cleanSearch,
        page: 1,
        
      });

      // adjust this depending on your GET /tracks response shape
      setTracks(data.tracks || data.items || data);
    } catch (error) {
      setMessage("Failed to load tracks.");
      console.log("Load tracks error:", error);
    }
  }

  function toggleTrack(trackId) {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  }

  async function handleAddSelected() {
    if (selectedTrackIds.length === 0) {
      setMessage("Select at least one track.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      for (const trackId of selectedTrackIds) {
        await addTrackToPlaylist(playlistId, trackId);
      }
      await onTracksAdded();
      onClose();
    } catch (error) {
      setMessage("Failed to add tracks.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Add Tracks</h2>

      <input
        value={search}
        placeholder="Search tracks..."
        onChange={(e) => setSearch(e.target.value)}
      />

      <button onClick={loadTracks}>Search</button>

      {message && <p>{message}</p>}

      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {tracks.map((track) => (
          <div key={track.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedTrackIds.includes(track.id)}
                onChange={() => toggleTrack(track.id)}
              />

              {track.title} — {track.artist || "Unknown Artist"}
            </label>
          </div>
        ))}
      </div>

      <button onClick={onClose} disabled={saving}>
        Cancel
      </button>

      <button onClick={handleAddSelected} disabled={saving}>
        {saving ? "Adding..." : "Add Selected"}
      </button>
    </div>
  );
}