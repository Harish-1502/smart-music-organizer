import DownloadedPlaylistCard from "./DownloadedPlaylistCard";

export default function DownloadedPlaylistsSection({
  loading,
  summary,
  storageAvailable,
  hasPlaylists,
  playlists,
  missingAudioWarning,
  message,
  messageTone,
  onClearAll,
  onPlayOffline,
  onDeletePlaylist,
  formatStorageSize,
  formatDownloadedDate,
}) {
  return (
    <>
      {message ? (
        <p
          className={`downloaded-page__message downloaded-page__message--${messageTone}`}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      {missingAudioWarning ? (
        <section className="downloaded-page__warning" role="alert">
          <p className="downloaded-page__warning-title">
            Missing offline audio files
          </p>
          <p className="downloaded-page__warning-text">
            {missingAudioWarning}
          </p>
        </section>
      ) : null}

      {loading && !summary ? (
        <section className="downloaded-page__state" aria-live="polite">
          <p className="downloaded-page__state-title">
            Loading offline storage...
          </p>
          <p className="downloaded-page__state-text">
            Reading downloaded playlist data from local offline storage.
          </p>
        </section>
      ) : null}

      {!loading && !storageAvailable ? (
        <section className="downloaded-page__state downloaded-page__state--unavailable">
          <p className="downloaded-page__state-title">
            Offline storage is unavailable in this browser.
          </p>
          <p className="downloaded-page__state-text">
            Local offline storage is unavailable or blocked on this device.
          </p>
        </section>
      ) : null}

      {!loading && storageAvailable && !hasPlaylists ? (
        <section className="downloaded-page__state downloaded-page__state--empty">
          <p className="downloaded-page__state-title">
            No downloaded playlists yet.
          </p>
          <p className="downloaded-page__state-text">
            Download a playlist from the playlist page or use Download Full
            Library in LAN Mode.
          </p>
        </section>
      ) : null}

      {!loading && storageAvailable && hasPlaylists ? (
        <section
          className="downloaded-page__content"
          aria-label="Downloaded playlists"
        >
          <div className="downloaded-page__section-header">
            <div>
              <p className="downloaded-page__section-eyebrow">
                Stored playlists
              </p>
              <h2 className="downloaded-page__section-title">
                Downloaded playlists
              </h2>
            </div>
            <button
              type="button"
              className="downloaded-page__button downloaded-page__button--danger"
              onClick={onClearAll}
            >
              Clear All Downloads
            </button>
          </div>

          <div className="downloaded-page__playlist-grid">
            {playlists.map((playlist) => (
              <DownloadedPlaylistCard
                key={playlist.id}
                playlist={playlist}
                onPlayOffline={onPlayOffline}
                onDeletePlaylist={onDeletePlaylist}
                formatStorageSize={formatStorageSize}
                formatDownloadedDate={formatDownloadedDate}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
