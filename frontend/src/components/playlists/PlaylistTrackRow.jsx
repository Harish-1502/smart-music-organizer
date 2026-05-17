export default function PlaylistTrackRow({ track, onRemove, onPlay }) {
  return (
    <div className="playlist-detail-page__track-card" role="listitem">
      <button
        type="button"
        className="playlist-detail-page__track-trigger"
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
      >
        <span className="playlist-detail-page__track-position">{track.position}</span>

        <span className="playlist-detail-page__track-copy">
          <strong className="playlist-detail-page__track-title">{track.title}</strong>

          <span className="playlist-detail-page__track-meta">
            <span className="playlist-detail-page__track-artist">
              {track.artist || "Unknown Artist"}
            </span>

            {track.album && (
              <>
                <span
                  className="playlist-detail-page__track-separator"
                  aria-hidden="true"
                >
                  |
                </span>
                <span className="playlist-detail-page__track-album">
                  {track.album}
                </span>
              </>
            )}
          </span>
        </span>
      </button>

      <button
        type="button"
        className="playlist-detail-page__button playlist-detail-page__button--danger"
        onClick={() => onRemove(track.playlist_track_id)}
      >
        Remove
      </button>
    </div>
  );
}
