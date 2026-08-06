export default function DownloadedPlaylistCard({
  playlistCard,
  onPlayOffline,
  onDeletePlaylist,
}) {
  return (
    <article className="downloaded-page__playlist-card">
      <div className="downloaded-page__playlist-copy">
        <p className="downloaded-page__playlist-label">Playlist</p>
        <h3 className="downloaded-page__playlist-name">{playlistCard.name}</h3>
        <p className="downloaded-page__playlist-meta">
          {playlistCard.trackCountLabel}
        </p>
        <p className="downloaded-page__playlist-meta">
          {playlistCard.offlineSizeLabel}
        </p>
        <p className="downloaded-page__playlist-meta">
          {playlistCard.downloadedAtLabel}
        </p>
        <p className="downloaded-page__playlist-status">
          {playlistCard.statusLabel}
        </p>
      </div>

      <div
        className="downloaded-page__playlist-actions"
        role="group"
        aria-label={playlistCard.actionLabel}
      >
        <button
          type="button"
          className="downloaded-page__button downloaded-page__button--secondary"
          onClick={() => onPlayOffline(playlistCard.id)}
        >
          Play Offline
        </button>
        <button
          type="button"
          className="downloaded-page__button downloaded-page__button--ghost-danger"
          onClick={() => onDeletePlaylist(playlistCard.id)}
        >
          Delete Download
        </button>
      </div>
    </article>
  );
}
