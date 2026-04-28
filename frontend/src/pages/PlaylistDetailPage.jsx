import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getPlaylistDetail,
  removeTrackFromPlaylist,
} from "../api/playlistApi";
import PlaylistTrackRow from "../components/playlists/PlaylistTrackRow";
import AddTracksModal from "../components/playlists/AddTracksModal";
import ReorderTracksModal from "../components/playlists/ReorderTracksModal"

export default function PlaylistDetailPage() {
  const { playlistId } = useParams();

  const [playlist, setPlaylist] = useState(null);
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showReorderModal, setShowReorderModal] = useState(false);

  useEffect(() => {
    loadPlaylist();
  }, [playlistId]);

  async function loadPlaylist() {
    setLoading(true);
    setMessage("");

    try {
      const data = await getPlaylistDetail(playlistId);
      setPlaylist(data);
    } catch (error) {
      setMessage("Failed to load playlist.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveTrack(playlistTrackId) {
    try {
      await removeTrackFromPlaylist(playlistId, playlistTrackId);

      setPlaylist((prev) => ({
        ...prev,
        tracks: prev.tracks.filter(
          (track) => track.playlist_track_id !== playlistTrackId
        ),
      }));
    } catch (error) {
      setMessage("Failed to remove track.");
    }
  }

  if (loading) return <p>Loading playlist...</p>;
  if (!playlist) return <p>{message || "Playlist not found."}</p>;

  return (
    <div>
      <h1>{playlist.name}</h1>

      {message && <p>{message}</p>}

      <button onClick={() => setShowAddTracksModal(true)}>
        Add Tracks
      </button>
      <button onClick={() => setShowReorderModal(true)}>
        Reorder Tracks
      </button>

      {playlist.tracks.length === 0 ? (
        <p>This playlist is empty.</p>
      ) : (
        <div>
          {playlist.tracks.map((track) => (
            <PlaylistTrackRow
              key={track.playlist_track_id}
              track={track}
              onRemove={handleRemoveTrack}
            />
          ))}
        </div>
      )}

      {showAddTracksModal && (
        <AddTracksModal
            playlistId={playlistId}
            onClose={() => setShowAddTracksModal(false)}
            onTracksAdded={loadPlaylist}
        />
      )}

      {showReorderModal && (
        <ReorderTracksModal
            playlistId={playlistId}
            tracks={playlist.tracks}
            onClose={() => setShowReorderModal(false)}
            onReorder={loadPlaylist}
        />
      )}
    </div>
  );
}