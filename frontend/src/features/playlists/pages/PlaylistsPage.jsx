import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAppMode,
  isOfflineMode,
  subscribeToAppModeChanges,
} from "../../../appMode/appMode";
import CreatePlaylistModal from "../components/CreatePlaylistModal";
import GenerateAiPlaylistModal from "../components/GenerateAiPlaylistModal";
import { featureFlags } from "../../../config/featureFlags";
import { getPlaylistSourceForMode } from "../../../playlists/playlistSource";
import "../../../styles/PlaylistsPage.css";

export default function PlaylistsPage({
  initialAppMode = null,
  initialPlaylists = null,
  initialLoading = null,
  initialMessage = "",
  sourceOverride = null,
}) {
  const navigate = useNavigate();
  const [appMode, setAppMode] = useState(() => initialAppMode ?? getAppMode());
  const offlineModeEnabled = isOfflineMode(appMode);
  const playlistSource =
    sourceOverride ?? getPlaylistSourceForMode(initialAppMode ?? appMode);
  const [playlists, setPlaylists] = useState(() => initialPlaylists ?? []);
  const [loading, setLoading] = useState(() =>
    initialLoading ?? initialPlaylists === null,
  );
  const [message, setMessage] = useState(() => initialMessage);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => subscribeToAppModeChanges(setAppMode), []);

  useEffect(() => {
    loadPlaylists();
  }, [playlistSource]);

  async function loadPlaylists() {
    setLoading(true);
    setMessage("");

    try {
      const data = await playlistSource.getPlaylists();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Failed to load playlists.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlaylist(name) {
    if (!playlistSource.supportsCreate) {
      return;
    }

    try {
      const newPlaylist = await playlistSource.createPlaylist(name);
      setPlaylists((prev) => [newPlaylist, ...prev]);
      setShowCreateModal(false);
    } catch (error) {
      throw error;
    }
  }

  async function handleGenerateAiPlaylist(prompt) {
    if (!playlistSource.supportsCreate) {
      return;
    }

    try {
      const generatedPlaylist = await playlistSource.generateAiPlaylist(prompt);
      setShowAiModal(false);
      navigate(`/playlists/${generatedPlaylist.playlist_id}`);
    } catch (error) {
      throw error;
    }
  }

  async function handleDeletePlaylist(playlistId) {
    if (!playlistSource.supportsDelete) {
      return;
    }

    const confirmed = window.confirm("Delete this playlist?");
    if (!confirmed) return;

    try {
      await playlistSource.deletePlaylist(playlistId);
      setPlaylists((prev) =>
        prev.filter((playlist) => playlist.id !== playlistId),
      );
    } catch {
      setMessage("Failed to delete playlist.");
    }
  }

  async function handleRenameClick(playlist) {
    if (!playlistSource.supportsRename) {
      return;
    }

    const newName = window.prompt("Enter new playlist name:", playlist.name);

    if (!newName || newName.trim() === playlist.name) return;

    try {
      const updated = await playlistSource.renamePlaylist(playlist.id, newName);

      setPlaylists((prev) =>
        prev.map((entry) =>
          entry.id === playlist.id
            ? {
                ...entry,
                name: updated.name,
                updated_at: updated.updated_at ?? entry.updated_at,
                updatedAt: updated.updatedAt ?? entry.updatedAt,
              }
            : entry,
        ),
      );
    } catch {
      setMessage("Failed to rename playlist.");
    }
  }

  const recentlyUpdatedPlaylists = [...playlists]
    .sort(
      (left, right) =>
        new Date(right.updated_at || right.updatedAt || 0) -
        new Date(left.updated_at || left.updatedAt || 0),
    )
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
                  {offlineModeEnabled
                    ? "Browse downloaded playlists stored on this device. Backend playlist actions stay disabled in Offline Mode."
                    : "Build collections you can jump back into fast."}
                </p>
                {offlineModeEnabled ? (
                  <p className="playlist-page__mode-badge">Offline Mode</p>
                ) : null}
              </div>

              {!offlineModeEnabled ? (
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
              ) : (
                <div className="playlist-page__offline-note">
                  Storage management stays on the{" "}
                  <Link to="/downloaded" className="playlist-page__inline-link">
                    Downloaded page
                  </Link>
                  .
                </div>
              )}
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
                  {offlineModeEnabled ? "Offline playlists" : "Saved playlists"}
                </span>
              </div>
              <div className="playlist-page__hero-stat">
                <span className="playlist-page__hero-stat-value">
                  {offlineModeEnabled ? "Local" : "Instant"}
                </span>
                <span className="playlist-page__hero-stat-label">
                  {offlineModeEnabled
                    ? "Playback from this device"
                    : "Access from your library"}
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
            <p className="playlist-page__state-title">
              {offlineModeEnabled
                ? "No offline playlists downloaded yet"
                : "No playlists yet"}
            </p>
            <p className="playlist-page__state-text">
              {offlineModeEnabled
                ? "No offline playlists downloaded yet. Switch to LAN Mode and download a playlist first."
                : "Create your first playlist to organize favorites, moods, or sets."}
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
                    {offlineModeEnabled
                      ? "Downloaded playlists available for local playback on this device."
                      : "Your main listening spaces, arranged for quick scanning and fast actions."}
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
                            dateTime={playlist.updated_at || playlist.updatedAt}
                          >
                            Updated{" "}
                            {new Date(
                              playlist.updated_at || playlist.updatedAt,
                            ).toLocaleString()}
                          </time>
                          {offlineModeEnabled ? (
                            <span className="playlist-card__meta">
                              {playlist.totalTracks ?? 0} offline tracks
                            </span>
                          ) : null}
                        </span>
                      </div>

                      {!offlineModeEnabled ? (
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
                      ) : null}
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
                  {offlineModeEnabled
                    ? "Quick access to the offline playlists stored on this device."
                    : "Quick access to the playlists you changed most recently."}
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
                          dateTime={playlist.updated_at || playlist.updatedAt}
                        >
                          Updated{" "}
                          {new Date(
                            playlist.updated_at || playlist.updatedAt,
                          ).toLocaleString()}
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

      {!offlineModeEnabled && showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePlaylist}
        />
      )}

      {!offlineModeEnabled && featureFlags.enableAiPlaylists && showAiModal && (
        <GenerateAiPlaylistModal
          onClose={() => setShowAiModal(false)}
          onGenerate={handleGenerateAiPlaylist}
        />
      )}
    </section>
  );
}
