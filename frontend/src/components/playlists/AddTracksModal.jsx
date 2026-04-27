import { useEffect, useState } from "react";
import { getTracks } from "../../api/libraryApi";
import { addTrackToPlaylist } from "../../api/playlistApi";
import useTrackBrowser from "../../hooks/useTrackBrowser";
import TrackBrowser from "../TrackBrowser";

export default function AddTracksModal({ playlistId, onClose, onTracksAdded }) {
  const [tracks, setTracks] = useState([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const browser = useTrackBrowser();

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          width: "90vw",
          maxWidth: "1100px",
          height: "85vh",
          padding: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2>Add Tracks</h2>

        {message && <p style={{ color: "red" }}>{message}</p>}

        <p>Selected: {selectedTrackIds.length}</p>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <TrackBrowser
            browser={browser}
            mode="picker"
            selectedTrackIds={selectedTrackIds}
            onToggleTrack={toggleTrack}
          />
        </div>

        <div
          style={{
            borderTop: "1px solid #ddd",
            paddingTop: "12px",
            marginTop: "12px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button onClick={onClose} disabled={saving}>
            Cancel
          </button>

          <button onClick={handleAddSelected} disabled={saving}>
            {saving ? "Adding..." : `Add Selected (${selectedTrackIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}