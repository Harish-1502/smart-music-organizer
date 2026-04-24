import { useState } from "react";

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
      const detail = error.response?.data?.detail;
      setError(detail || "Failed to create playlist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div>
        <h2>Create Playlist</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            placeholder="Playlist name"
            onChange={(e) => setName(e.target.value)}
          />

          {error && <p>{error}</p>}

          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>

          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}