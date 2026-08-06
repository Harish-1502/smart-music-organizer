import DownloadedPlaylistCard from "./DownloadedPlaylistCard";
import DownloadedStatusBanner from "./DownloadedStatusBanner";

export default function DownloadedPlaylistsSection({
  sectionState,
  playlistCards,
  message,
  messageTone,
  onClearAll,
  onPlayOffline,
  onDeletePlaylist,
}) {
  const {
    isStorageLoading,
    hasSummary,
    storageAvailable,
    hasPlaylists,
    missingAudioWarning,
  } = sectionState;

  return (
    <>
      <DownloadedStatusBanner message={message} messageTone={messageTone} />

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

      {isStorageLoading && !hasSummary ? (
        <section className="downloaded-page__state" aria-live="polite">
          <p className="downloaded-page__state-title">
            Loading offline storage...
          </p>
          <p className="downloaded-page__state-text">
            Reading downloaded playlist data from local offline storage.
          </p>
        </section>
      ) : null}

      {!isStorageLoading && !storageAvailable ? (
        <section className="downloaded-page__state downloaded-page__state--unavailable">
          <p className="downloaded-page__state-title">
            Offline storage is unavailable in this browser.
          </p>
          <p className="downloaded-page__state-text">
            Local offline storage is unavailable or blocked on this device.
          </p>
        </section>
      ) : null}

      {!isStorageLoading && storageAvailable && !hasPlaylists ? (
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

      {!isStorageLoading && storageAvailable && hasPlaylists ? (
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
            {playlistCards.map((playlistCard) => (
              <DownloadedPlaylistCard
                key={playlistCard.id}
                playlistCard={playlistCard}
                onPlayOffline={onPlayOffline}
                onDeletePlaylist={onDeletePlaylist}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
