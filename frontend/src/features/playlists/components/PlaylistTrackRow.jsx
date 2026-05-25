import { maskTrack } from "../../../utils/demoMode";

export default function PlaylistTrackRow({ track, onRemove, onPlay }) {
  const displayTrack = maskTrack(track, track.position ? track.position - 1 : 0);

  return (
    <div className="playlist-detail-page__track-card" role="listitem">
      <button
        type="button"
        className="playlist-detail-page__track-trigger"
        onClick={onPlay}
        aria-label={`Play ${displayTrack.title}`}
      >
        <span className="playlist-detail-page__track-position">{track.position}</span>

        <span className="playlist-detail-page__track-copy">
          <strong className="playlist-detail-page__track-title">{displayTrack.title}</strong>

          <span className="playlist-detail-page__track-meta">
            <span className="playlist-detail-page__track-artist">
              {displayTrack.artist || "Unknown Artist"}
            </span>

            {displayTrack.album && (
              <>
                <span
                  className="playlist-detail-page__track-separator"
                  aria-hidden="true"
                >
                  |
                </span>
                <span className="playlist-detail-page__track-album">
                  {displayTrack.album}
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
