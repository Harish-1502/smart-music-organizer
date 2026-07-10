import { useState } from "react";

import { maskTrack } from "../../../utils/demoMode";
import {
  getTrackDisplayArtist,
  getTrackDisplayTitle,
} from "../utils/trackDisplay";

export default function PlayerQueuePanel({
  queueItems,
  currentIndex,
  canJumpQueue,
  onSelectIndex,
}) {
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const hasQueueItems = Array.isArray(queueItems) && queueItems.length > 0;

  return (
    <div className="player-page__queue-panel">
      <button
        type="button"
        className="player-page__queue-toggle"
        onClick={() => setIsQueueOpen((prev) => !prev)}
        aria-expanded={isQueueOpen}
        aria-controls="player-queue-list"
        disabled={!hasQueueItems}
      >
        {isQueueOpen ? "Hide Queue" : "Show Queue"}
      </button>

      {isQueueOpen && (
        <div
          id="player-queue-list"
          className="player-page__queue-list"
          role="list"
          aria-label="Playback queue"
        >
          {queueItems.map((track, index) => {
            const isCurrent = index === currentIndex;
            const isTrackValid = track && typeof track === "object";
            const isInteractive = canJumpQueue && isTrackValid;
            const itemKey = `${track?.track_id ?? track?.id ?? "queue"}-${index}`;
            const displayQueueTrack = maskTrack(track, index);

            if (isInteractive) {
              return (
                <button
                  key={itemKey}
                  type="button"
                  className={`player-page__queue-item${
                    isCurrent ? " player-page__queue-item--current" : ""
                  }`}
                  onClick={() => onSelectIndex(index)}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  <span className="player-page__queue-position">
                    {index + 1}
                  </span>
                  <span className="player-page__queue-text">
                    <span className="player-page__queue-title">
                      {getTrackDisplayTitle(displayQueueTrack)}
                    </span>
                    <span className="player-page__queue-artist">
                      {getTrackDisplayArtist(displayQueueTrack)}
                    </span>
                  </span>
                </button>
              );
            }

            return (
              <div
                key={itemKey}
                className={`player-page__queue-item player-page__queue-item--readonly${
                  isCurrent ? " player-page__queue-item--current" : ""
                }`}
                role="listitem"
                aria-current={isCurrent ? "true" : undefined}
              >
                <span className="player-page__queue-position">{index + 1}</span>
                <span className="player-page__queue-text">
                  <span className="player-page__queue-title">
                    {getTrackDisplayTitle(displayQueueTrack)}
                  </span>
                  <span className="player-page__queue-artist">
                    {getTrackDisplayArtist(displayQueueTrack)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
