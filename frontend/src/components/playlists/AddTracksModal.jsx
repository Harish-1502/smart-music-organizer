import { useState } from "react";
import { addTrackToPlaylist } from "../../api/playlistApi";
import useTrackBrowser from "../../hooks/useTrackBrowser";
import TrackBrowser from "../TrackBrowser";
import "../../styles/playlist/AddTracksModal.css";

export default function AddTracksModal({ playlistId, onClose, onTracksAdded }) {
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
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
    <div className="add-tracks-modal__overlay">
      <div
        className="add-tracks-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tracks-modal-title"
        aria-describedby="add-tracks-modal-help"
      >
        <div className="add-tracks-modal__header">
          <div className="add-tracks-modal__header-copy">
            <p className="add-tracks-modal__eyebrow">Playlist</p>
            <h2
              id="add-tracks-modal-title"
              className="add-tracks-modal__title"
            >
              Add tracks
            </h2>
            <p
              id="add-tracks-modal-help"
              className="add-tracks-modal__subtitle"
            >
              Search, filter, and select tracks to add to this playlist.
            </p>
          </div>

          <p className="add-tracks-modal__count" aria-live="polite">
            {selectedTrackIds.length} selected
          </p>
        </div>

        {message && (
          <p className="add-tracks-modal__message" role="alert">
            {message}
          </p>
        )}

        <div className="add-tracks-modal__body">
          <div className="add-tracks-modal__browser">
            <TrackBrowser
              browser={browser}
              mode="picker"
              selectedTrackIds={selectedTrackIds}
              onToggleTrack={toggleTrack}
            />
          </div>
        </div>

        <div className="add-tracks-modal__actions">
          <button
            type="button"
            className="add-tracks-modal__button add-tracks-modal__button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="add-tracks-modal__button add-tracks-modal__button--primary"
            onClick={handleAddSelected}
            disabled={saving}
          >
            {saving ? "Adding..." : `Add Selected (${selectedTrackIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}