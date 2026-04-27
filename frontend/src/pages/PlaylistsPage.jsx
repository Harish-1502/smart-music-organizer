import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
} from "../api/playlistApi";
import CreatePlaylistModal from "../components/playlists/CreatePlaylistModal";

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

  async function handleRenameClick(playlist) {
    const newName = window.prompt("Enter new playlist name:", playlist.name);

    if (!newName || newName.trim() === playlist.name) return;

    try {
      const updated = await renamePlaylist(playlist.id, newName);

      // Update state without refetching
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlist.id 
            ? {
                 ...p,
                 name: updated.name,
                 updated_at: updated.updated_at    
            } : p
        )
      );
    } catch (error) {
      setMessage("Failed to rename playlist.");
    }
  }

  return (
    <div>
      <h1>Playlists</h1>

      <button onClick={() => setShowCreateModal(true)}>
        + Create Playlist
      </button>

      {message && <p style={{ color: "red" }}>{message}</p>}
      {loading && <p>Loading playlists...</p>}

      {!loading && playlists.length === 0 && (
        <p>No playlists yet. Create one to get started.</p>
      )}

      {!loading && playlists.length > 0 && (
        <table
          border="1"
          cellPadding="10"
          style={{ marginTop: "16px", width: "100%" }}
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {playlists.map((playlist) => (
              <tr key={playlist.id}>
                <td>
                    <Link to={`/playlists/${playlist.id}`}>
                        {playlist.name}
                    </Link>
                </td>

                <td>
                  {new Date(playlist.updated_at).toLocaleString()}
                </td>

                <td>
                  <button onClick={() => handleRenameClick(playlist)}>
                    Rename
                  </button>

                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    style={{ marginLeft: "8px", color: "red" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePlaylist}
        />
      )}
    </div>
  );
}