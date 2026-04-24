import { useEffect, useState } from "react";
import { getPlaylists, createPlaylist, deletePlaylist } from "../api/playlistApi";
import CreatePlaylistModal from "../components/playlists/CreatePlaylistModal";
import PlaylistCard from "../components/playlists/PlaylistCard";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    setLoading(true);
    setMessage("");

    try {
      const data = await getPlaylists();
      setPlaylists(data);
    } catch (error) {
      setMessage("Failed to load playlists.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlaylist(name) {
    try {
      const newPlaylist = await createPlaylist(name);
      setPlaylists((prev) => [newPlaylist, ...prev]);
      setShowCreateModal(false);
    } catch (error) {
      throw error;
    }
  }

  async function handleDeletePlaylist(playlistId) {
    const confirmed = window.confirm("Delete this playlist?");

    if (!confirmed) return;

    try {
      await deletePlaylist(playlistId);
      setPlaylists((prev) =>
        prev.filter((playlist) => playlist.id !== playlistId)
      );
    } catch (error) {
      setMessage("Failed to delete playlist.");
    }
  }

  return (
    <div>
      <h1>Playlists</h1>

      <button onClick={() => setShowCreateModal(true)}>
        + Create Playlist
      </button>

      {message && <p>{message}</p>}
      {loading && <p>Loading playlists...</p>}

      {!loading && playlists.length === 0 && (
        <p>No playlists yet. Create one to get started.</p>
      )}

      <div>
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            onDelete={handleDeletePlaylist}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePlaylist}
        />
      )}
    </div>
  );
}