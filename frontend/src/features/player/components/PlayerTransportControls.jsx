import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";

export default function PlayerTransportControls({
  isPlaying,
  isLoading,
  transportDisabled,
  shuffleEnabled,
  repeatMode,
  onTogglePlayback,
  onPreviousTrack,
  onNextTrack,
  onToggleShuffle,
  onCycleRepeatMode,
}) {
  return (
    <div
      className="player-page__controls"
      role="group"
      aria-label="Playback controls"
    >
      <button
        type="button"
        className={`player-page__control player-page__control--mode player-page__control--shuffle${
          shuffleEnabled ? " player-page__control--shuffle-active" : ""
        }`}
        onClick={onToggleShuffle}
        aria-pressed={shuffleEnabled}
        aria-label={shuffleEnabled ? "Shuffle on" : "Shuffle off"}
      >
        <Shuffle className="player-page__icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="player-page__control player-page__control--secondary"
        onClick={onPreviousTrack}
        aria-label="Previous track"
        disabled={isLoading}
      >
        <SkipBack className="player-page__icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="player-page__control player-page__control--primary"
        onClick={onTogglePlayback}
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={transportDisabled}
      >
        {isPlaying ? (
          <Pause
            className="player-page__icon player-page__icon--primary"
            aria-hidden="true"
          />
        ) : (
          <Play
            className="player-page__icon player-page__icon--primary"
            aria-hidden="true"
          />
        )}
      </button>
      <button
        type="button"
        className="player-page__control player-page__control--secondary"
        onClick={onNextTrack}
        aria-label="Next track"
        disabled={isLoading}
      >
        <SkipForward className="player-page__icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`player-page__control player-page__control--mode player-page__control--repeat${
          repeatMode === "track"
            ? " player-page__control--repeat-one"
            : repeatMode === "playlist"
              ? " player-page__control--repeat-all"
              : ""
        }`}
        onClick={onCycleRepeatMode}
        aria-label={
          repeatMode === "track"
            ? "Repeat one"
            : repeatMode === "playlist"
              ? "Repeat all"
              : "Repeat off"
        }
      >
        <span className="player-page__repeat-icon-wrap" aria-hidden="true">
          <Repeat className="player-page__icon" />
          {repeatMode === "track" && (
            <span className="player-page__repeat-badge">1</span>
          )}
        </span>
      </button>
    </div>
  );
}
