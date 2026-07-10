import { Volume2, VolumeX } from "lucide-react";

export default function PlayerVolumeControls({
  volume,
  isMuted,
  onSetVolumeLevel,
  onToggleMute,
}) {
  function handleVolumeChange(event) {
    const rawValue = Number(event.target.value);
    const nextVolume = Math.min(100, Math.max(0, Math.round(rawValue)));
    onSetVolumeLevel(nextVolume);
  }

  return (
    <div className="player-page__volume" aria-label="Volume controls">
      <button
        type="button"
        className="player-page__volume-button"
        onClick={onToggleMute}
        aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
        aria-pressed={isMuted}
      >
        {isMuted || volume === 0 ? (
          <VolumeX
            className="player-page__icon player-page__icon--volume"
            aria-hidden="true"
          />
        ) : (
          <Volume2
            className="player-page__icon player-page__icon--volume"
            aria-hidden="true"
          />
        )}
      </button>
      <input
        className="player-page__volume-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={volume}
        onChange={handleVolumeChange}
        aria-label="Volume"
      />
    </div>
  );
}
