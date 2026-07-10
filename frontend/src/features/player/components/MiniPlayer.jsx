import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  Repeat,
  Shuffle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext";
import { getTrackArtPath } from "../../../api/apiBase";
import {
  getTrackDisplayArtist,
  getTrackDisplayTitle,
} from "../utils/trackDisplay";
import useAuthenticatedBlobUrl from "../../../shared/hooks/useAuthenticatedBlobUrl";
import { maskTrack, shouldHideDemoArtwork } from "../../../utils/demoMode";

// Call actions safely from JSX without recreating the wrapper each render.
function safeInvokeAction(action) {
  if (typeof action !== "function") {
    return;
  }

  try {
    action();
  } catch (error) {
    console.error("MiniPlayer control failed:", error);
  }
}

export default function MiniPlayer() {
  const navigate = useNavigate();
  const {
    currentTrack,
    artworkUrl: offlineArtworkUrl,
    isPlaying,
    togglePlayPause,
    nextTrack,
    previousTrack,
    shuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();
  const displayTrack = maskTrack(currentTrack);
  const title = getTrackDisplayTitle(displayTrack);
  const artist = getTrackDisplayArtist(displayTrack);

  const currentTrackId = currentTrack?.track_id ?? currentTrack?.id ?? null;
  const artPath =
    shouldHideDemoArtwork() || !currentTrackId || currentTrack?.offline
      ? ""
      : getTrackArtPath(currentTrackId);
  const { blobUrl: artUrl } = useAuthenticatedBlobUrl(artPath, {
    enabled: Boolean(artPath),
  });
  const resolvedArtUrl = offlineArtworkUrl || artUrl;

  if (!currentTrack) {
    return null;
  }

  function handleOpenPlayer() {
    if (!currentTrack) {
      return;
    }

    navigate("/player");
  }

  // Note: we keep event.stopPropagation/preventDefault inline in JSX
  // to avoid recreating helper functions that depend on runtime values.

  return (
    <div className={`mini-player${isPlaying ? " mini-player--playing" : ""}`}>
      <button
        type="button"
        className="mini-player__info"
        onClick={handleOpenPlayer}
        aria-label="Open player"
      >
        <div
          className={`mini-player__art${isPlaying ? " mini-player__art--playing" : ""}`}
          aria-hidden="true"
        >
          {resolvedArtUrl ? (
            <img className="mini-player__art-image" src={resolvedArtUrl} alt="" />
          ) : (
            <span className="mini-player__art-fallback">♪</span>
          )}
        </div>

        <div className="mini-player__meta">
          <div className="mini-player__title">{title}</div>
          <div className="mini-player__artist">{artist}</div>
        </div>
      </button>

      <div className="mini-player__controls">
        <button
          type="button"
          className={`mini-player__button${shuffleEnabled ? " mini-player__button--active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            safeInvokeAction(toggleShuffle);
          }}
          aria-pressed={shuffleEnabled}
          aria-label="Toggle shuffle"
        >
          <Shuffle />
        </button>

        <button
          type="button"
          className="mini-player__button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            safeInvokeAction(previousTrack);
          }}
          aria-label="Previous track"
        >
          <ArrowLeft />
        </button>

        <button
          type="button"
          className="mini-player__button mini-player__button--primary"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            safeInvokeAction(togglePlayPause);
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>

        <button
          type="button"
          className="mini-player__button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            safeInvokeAction(nextTrack);
          }}
          aria-label="Next track"
        >
          <ArrowRight />
        </button>

        <button
          type="button"
          className={`mini-player__button mini-player__button--repeat${repeatMode === "off" ? "" : " mini-player__button--active"}`}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            safeInvokeAction(cycleRepeatMode);
          }}
          aria-label={
            repeatMode === "off"
              ? "Repeat off"
              : repeatMode === "playlist"
                ? "Repeat all"
                : "Repeat one"
          }
        >
          <Repeat />
          {repeatMode === "track" && (
            <span className="mini-player__repeat-badge" aria-hidden="true">
              1
            </span>
          )}
        </button>
      </div>
      <div className="mini-player__actions" aria-hidden="true"></div>
    </div>
  );
}
