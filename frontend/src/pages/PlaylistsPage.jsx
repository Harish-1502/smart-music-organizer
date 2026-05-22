import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  generateAiPlaylist,
} from "../api/playlistApi";
import CreatePlaylistModal from "../components/playlists/CreatePlaylistModal";
import GenerateAiPlaylistModal from "../components/playlists/GenerateAiPlaylistModal";
import { featureFlags } from "../config/featureFlags";
import "../styles/PlaylistsPage.css";

export default function PlaylistsPage() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

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

  async function handleGenerateAiPlaylist(prompt) {
    try {
      const generatedPlaylist = await generateAiPlaylist(prompt);
      setShowAiModal(false);
      navigate(`/playlists/${generatedPlaylist.playlist_id}`);
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
                updated_at: updated.updated_at,
              }
            : p
        )
      );
    } catch (error) {
      setMessage("Failed to rename playlist.");
    }
  }

  const recentlyUpdatedPlaylists = [...playlists]
  .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  .slice(0, 3);

  return (
    <section className="playlist-page" aria-labelledby="playlists-title">
      <div className="playlist-page__inner">
        <header className="playlist-page__hero">
          <div className="playlist-page__hero-panel">
            <div className="playlist-page__header">
              <div className="playlist-page__copy">
                <p className="playlist-page__eyebrow">Your library</p>
                <h1 id="playlists-title" className="playlist-page__title">
                  Playlists
                </h1>
                <p className="playlist-page__subtitle">
                  Build collections you can jump back into fast.
                </p>
              </div>

              <div className="playlist-page__header-actions">
                {featureFlags.enableAiPlaylists && (
                  <button
                    type="button"
                    className="playlist-page__create playlist-page__create--secondary"
                    onClick={() => setShowAiModal(true)}
                  >
                    Generate with AI
                  </button>
                )}

                <button
                  type="button"
                  className="playlist-page__create"
                  onClick={() => setShowCreateModal(true)}
                >
                  + Create Playlist
                </button>
              </div>
            </div>

            <div
              className="playlist-page__hero-stats"
              aria-label="Playlist summary"
            >
              <div className="playlist-page__hero-stat">
                <span className="playlist-page__hero-stat-value">
                  {playlists.length}
                </span>
                <span className="playlist-page__hero-stat-label">
                  Saved playlists
                </span>
              </div>
              <div className="playlist-page__hero-stat">
                <span className="playlist-page__hero-stat-value">Instant</span>
                <span className="playlist-page__hero-stat-label">
                  Access from your library
                </span>
              </div>
            </div>
          </div>
        </header>

        {message && (
          <p className="playlist-page__message" role="alert">
            {message}
          </p>
        )}

        {loading && (
          <div className="playlist-page__state" aria-live="polite">
            <p className="playlist-page__state-title">Loading playlists...</p>
            <p className="playlist-page__state-text">
              Fetching your saved collections.
            </p>
          </div>
        )}

        {!loading && playlists.length === 0 && (
          <div className="playlist-page__state playlist-page__state--empty">
            <p className="playlist-page__state-title">No playlists yet</p>
            <p className="playlist-page__state-text">
              Create your first playlist to organize favorites, moods, or sets.
            </p>
          </div>
        )}

        {!loading && playlists.length > 0 && (
          <div className="playlist-page__content">
            <section
              className="playlist-page__section playlist-page__section--primary"
              aria-label="All playlists"
            >
              <div className="playlist-page__section-header">
                <div>
                  <h2 className="playlist-page__section-title">All playlists</h2>
                  <p className="playlist-page__section-subtitle">
                    Your main listening spaces, arranged for quick scanning and
                    fast actions.
                  </p>
                </div>
                <span
                  className="playlist-page__section-count"
                  aria-label={`${playlists.length} playlists`}
                >
                  {playlists.length} total
                </span>
              </div>

              <ul className="playlist-list" aria-label="Playlist library">
                {playlists.map((playlist) => (
                  <li key={playlist.id} className="playlist-card">
                    <Link
                      to={`/playlists/${playlist.id}`}
                      className="playlist-card__link"
                      aria-label={`Open ${playlist.name}`}
                    />

                    <div className="playlist-card__row">
                      <div className="playlist-card__main">
                        <span className="playlist-card__art" aria-hidden="true">
                          <span className="playlist-card__art-tile"></span>
                          <span className="playlist-card__art-tile"></span>
                          <span className="playlist-card__art-tile"></span>
                          <span className="playlist-card__art-tile"></span>
                        </span>

                        <span className="playlist-card__body">
                          <span className="playlist-card__label">Playlist</span>
                          <span className="playlist-card__name">
                            {playlist.name}
                          </span>
                          <time
                            className="playlist-card__meta"
                            dateTime={playlist.updated_at}
                          >
                            Updated {new Date(playlist.updated_at).toLocaleString()}
                          </time>
                        </span>
                      </div>

                      <div
                        className="playlist-card__actions"
                        role="group"
                        aria-label={`Actions for ${playlist.name}`}
                      >
                        <button
                          type="button"
                          className="playlist-card__action"
                          onClick={() => handleRenameClick(playlist)}
                        >
                          Rename
                        </button>

                        <button
                          type="button"
                          className="playlist-card__action playlist-card__action--danger"
                          onClick={() => handleDeletePlaylist(playlist.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="playlist-page__section playlist-page__section--secondary"
              aria-labelledby="recently-updated-title"
            >
              <div className="playlist-page__section-header">
                <h2
                  id="recently-updated-title"
                  className="playlist-page__section-title"
                >
                  Recently updated
                </h2>
                <p className="playlist-page__section-subtitle">
                  Quick access to the playlists you changed most recently.
                </p>
              </div>

              <ul
                className="playlist-list playlist-page__recent-list"
                aria-label="Recently updated playlists"
              >
                {recentlyUpdatedPlaylists.slice(0, 5).map((playlist) => (
                  <li
                    key={`recent-${playlist.id}`}
                    className="playlist-card playlist-card--compact"
                  >
                    <Link
                      to={`/playlists/${playlist.id}`}
                      className="playlist-card__main playlist-card__main--compact"
                    >
                      <span
                        className="playlist-card__art playlist-card__art--compact"
                        aria-hidden="true"
                      >
                        <span className="playlist-card__art-tile"></span>
                        <span className="playlist-card__art-tile"></span>
                        <span className="playlist-card__art-tile"></span>
                        <span className="playlist-card__art-tile"></span>
                      </span>

                      <span className="playlist-card__body">
                        <span className="playlist-card__label">Playlist</span>
                        <span className="playlist-card__name">
                          {playlist.name}
                        </span>
                        <time
                          className="playlist-card__meta"
                          dateTime={playlist.updated_at}
                        >
                          Updated {new Date(playlist.updated_at).toLocaleString()}
                        </time>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePlaylist}
        />
      )}

      {featureFlags.enableAiPlaylists && showAiModal && (
        <GenerateAiPlaylistModal
          onClose={() => setShowAiModal(false)}
          onGenerate={handleGenerateAiPlaylist}
        />
      )}
    </section>
  );
}
