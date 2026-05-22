import { useState } from "react";
import { getApiErrorMessage } from "../../api/apiErrors";

export default function CreatePlaylistModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setError("");

    try {
      await onCreate(name);
      setName("");
    } catch (error) {
      setError(getApiErrorMessage(error, "Failed to create playlist."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="playlist-modal__overlay">
      <div
        className="playlist-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-playlist-title"
      >
        <div className="playlist-modal__header">
          <h2 id="create-playlist-title" className="playlist-modal__title">
            Create Playlist
          </h2>
          <p className="playlist-modal__subtitle">
            Give your playlist a name to start building it.
          </p>
        </div>

        <form className="playlist-modal__form" onSubmit={handleSubmit}>
          <div className="playlist-modal__field">
            <label className="playlist-modal__label" htmlFor="playlist-name">
              Playlist name
            </label>

            <input
              id="playlist-name"
              className="playlist-modal__input"
              type="text"
              value={name}
              placeholder="Playlist name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && (
            <p className="playlist-modal__error" role="alert">
              {error}
            </p>
          )}

          <div className="playlist-modal__actions">
            <button
              type="button"
              className="playlist-modal__button playlist-modal__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="playlist-modal__button playlist-modal__button--primary"
              disabled={saving}
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
