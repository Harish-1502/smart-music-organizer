export default function DownloadedPlaylistCard({
  playlist,
  onPlayOffline,
  onDeletePlaylist,
  formatStorageSize,
  formatDownloadedDate,
}) {
  return (
    <article className="downloaded-page__playlist-card">
      <div className="downloaded-page__playlist-copy">
        <p className="downloaded-page__playlist-label">Playlist</p>
        <h3 className="downloaded-page__playlist-name">
          {playlist.name || "Untitled playlist"}
        </h3>
        <p className="downloaded-page__playlist-meta">
          {playlist.totalTracks ?? 0} tracks
        </p>
        <p className="downloaded-page__playlist-meta">
          Offline size {formatStorageSize(playlist.totalBytes ?? 0)}
        </p>
        <p className="downloaded-page__playlist-meta">
          Downloaded {formatDownloadedDate(playlist.downloadedAt)}
        </p>
        <p className="downloaded-page__playlist-status">
          Already downloaded for offline playback.
        </p>
      </div>

      <div
        className="downloaded-page__playlist-actions"
        role="group"
        aria-label={`Actions for ${playlist.name || "downloaded playlist"}`}
      >
        <button
          type="button"
          className="downloaded-page__button downloaded-page__button--secondary"
          onClick={() => onPlayOffline(playlist.id)}
        >
          Play Offline
        </button>
        <button
          type="button"
          className="downloaded-page__button downloaded-page__button--ghost-danger"
          onClick={() => onDeletePlaylist(playlist.id)}
        >
          Delete Download
        </button>
      </div>
    </article>
  );
}
