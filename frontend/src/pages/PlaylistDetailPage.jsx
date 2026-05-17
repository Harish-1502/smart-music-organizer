import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPlaylistDetail,
  removeTrackFromPlaylist,
} from "../api/playlistApi";
import PlaylistTrackRow from "../components/playlists/PlaylistTrackRow";
import AddTracksModal from "../components/playlists/AddTracksModal";
import ReorderTracksModal from "../components/playlists/ReorderTracksModal";
import { usePlayer } from "../context/PlayerContext";
import "../styles/PlaylistDetailPage.css";

export default function PlaylistDetailPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { playQueue } = usePlayer();

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

  function handleTrackPlay(startIndex) {
    if (!playlist?.tracks?.length) return;

    playQueue(playlist.tracks, startIndex);
    navigate("/player");
  }

  if (loading) {
    return (
      <main className="playlist-detail-page">
        <div className="playlist-detail-page__inner">
          <div className="playlist-detail-page__state-card" aria-live="polite">
            <p className="playlist-detail-page__state-title">Loading playlist...</p>
            <p className="playlist-detail-page__state-text">
              Pulling in tracks and playlist details.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!playlist) {
    return (
      <main className="playlist-detail-page">
        <div className="playlist-detail-page__inner">
          <div className="playlist-detail-page__state-card" role="status">
            <p className="playlist-detail-page__state-title">Playlist unavailable</p>
            <p className="playlist-detail-page__state-text">
              {message || "Playlist not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className="playlist-detail-page"
        aria-labelledby="playlist-detail-title"
      >
        <div className="playlist-detail-page__inner">
          <header className="playlist-detail-page__hero">
            <div className="playlist-detail-page__hero-panel">
              <div className="playlist-detail-page__hero-header">
                <div className="playlist-detail-page__hero-copy">
                  <p className="playlist-detail-page__eyebrow">Playlist</p>
                  <h1
                    id="playlist-detail-title"
                    className="playlist-detail-page__title"
                  >
                    {playlist.name}
                  </h1>
                </div>

                <div
                  className="playlist-detail-page__hero-actions"
                  role="group"
                  aria-label={`Actions for ${playlist.name}`}
                >
                  <button
                    type="button"
                    className="playlist-detail-page__button playlist-detail-page__button--primary"
                    onClick={() => setShowAddTracksModal(true)}
                  >
                    Add Tracks
                  </button>
                  <button
                    type="button"
                    className="playlist-detail-page__button playlist-detail-page__button--secondary"
                    onClick={() => setShowReorderModal(true)}
                  >
                    Reorder Tracks
                  </button>
                </div>
              </div>

              <div
                className="playlist-detail-page__hero-stats"
                aria-label="Playlist summary"
              >
                <div className="playlist-detail-page__hero-stat">
                  <span className="playlist-detail-page__hero-stat-value">
                    {playlist.tracks.length}
                  </span>
                  <span className="playlist-detail-page__hero-stat-label">
                    Tracks in playlist
                  </span>
                </div>
              </div>
            </div>
          </header>

          {message && (
            <p className="playlist-detail-page__message" role="alert">
              {message}
            </p>
          )}

          <section
            className="playlist-detail-page__section"
            aria-labelledby="playlist-tracks-title"
          >
            <div className="playlist-detail-page__section-header">

              <span
                className="playlist-detail-page__section-count"
                aria-label={`${playlist.tracks.length} tracks`}
              >
                {playlist.tracks.length} total
              </span>
            </div>

            {playlist.tracks.length === 0 ? (
              <div className="playlist-detail-page__empty-state">
                <p className="playlist-detail-page__empty-title">
                  This playlist is empty
                </p>
                <p className="playlist-detail-page__empty-text">
                  Add tracks to start building your next listening run.
                </p>
              </div>
            ) : (
              <div className="playlist-detail-page__track-list" role="list">
                {playlist.tracks.map((track, index) => (
                  <PlaylistTrackRow
                    key={track.playlist_track_id}
                    track={track}
                    onRemove={handleRemoveTrack}
                    onPlay={() => handleTrackPlay(index)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

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
    </>
  );
}
