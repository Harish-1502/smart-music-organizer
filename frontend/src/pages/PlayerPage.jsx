import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext";
import "../styles/PlayerPage.css";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function clampVolumePercent(value) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function PlayerPage() {
  const navigate = useNavigate();
  const {
    audioRef,
    currentTrack,
    currentIndex,
    queue,
    playQueue,
    getStreamUrl,
    handleEnded,
    isPlaying,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    nextTrack,
    previousTrack,
    stop,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();
  const progressBarRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Number.isFinite(currentTrack?.duration) ? currentTrack.duration : NaN
  );
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement || !currentTrack) return;

    if (isPlaying) {
      const playPromise = audioElement.play();
      playPromise?.catch(() => {});
      return;
    }

    audioElement.pause();
  }, [audioRef, currentTrack, isPlaying]);

  useEffect(() => {
    const audioElement = audioRef.current;
    const fallbackDuration = Number.isFinite(currentTrack?.duration)
      ? currentTrack.duration
      : NaN;

    function syncProgress() {
      setCurrentTime(
        Number.isFinite(audioElement?.currentTime) ? audioElement.currentTime : 0
      );
      setDuration(
        Number.isFinite(audioElement?.duration) && audioElement.duration > 0
          ? audioElement.duration
          : fallbackDuration
      );
    }

    setCurrentTime(
      Number.isFinite(audioElement?.currentTime) ? audioElement.currentTime : 0
    );
    setDuration(
      Number.isFinite(audioElement?.duration) && audioElement.duration > 0
        ? audioElement.duration
        : fallbackDuration
    );

    if (!audioElement) {
      return;
    }

    audioElement.addEventListener("timeupdate", syncProgress);
    audioElement.addEventListener("loadedmetadata", syncProgress);
    audioElement.addEventListener("durationchange", syncProgress);
    audioElement.addEventListener("emptied", syncProgress);

    return () => {
      audioElement.removeEventListener("timeupdate", syncProgress);
      audioElement.removeEventListener("loadedmetadata", syncProgress);
      audioElement.removeEventListener("durationchange", syncProgress);
      audioElement.removeEventListener("emptied", syncProgress);
    };
  }, [audioRef, currentTrack]);

  useEffect(() => {
    const audioElement = audioRef.current;

    function syncVolumeState() {
      if (!audioElement) {
        setVolume(100);
        setIsMuted(false);
        return;
      }

      setVolume(
        clampVolumePercent(
          Number.isFinite(audioElement.volume) ? audioElement.volume * 100 : 100
        )
      );
      setIsMuted(Boolean(audioElement.muted));
    }

    syncVolumeState();

    if (!audioElement) {
      return;
    }

    audioElement.addEventListener("volumechange", syncVolumeState);

    return () => {
      audioElement.removeEventListener("volumechange", syncVolumeState);
    };
  }, [audioRef, currentTrack]);

  const effectiveCurrentTime =
    isScrubbing && Number.isFinite(scrubTime) ? scrubTime : currentTime;

  const progressPercent =
    duration > 0 ? Math.min(100, (effectiveCurrentTime / duration) * 100) : 0;

  const formattedCurrentTime = formatTime(effectiveCurrentTime);
  const formattedDuration = formatTime(duration);
  const queueItems = Array.isArray(queue) ? queue : [];
  const hasQueueItems = queueItems.length > 0;
  const canJumpQueue = typeof playQueue === "function" && hasQueueItems;

  const playerThemeVars = {
    ...(currentTrack?.accentColor
      ? { "--player-accent": currentTrack.accentColor }
      : {}),
    ...(currentTrack?.accentColor2
      ? { "--player-accent-2": currentTrack.accentColor2 }
      : {}),
  };

  function handleBackNavigation() {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/playlists");
  }

  function getTimeFromClientX(clientX) {
    if (!(duration > 0) || !progressBarRef.current) {
      return 0;
    }

    const rect = progressBarRef.current.getBoundingClientRect();

    if (!(rect.width > 0)) {
      return 0;
    }

    const clampedX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return (clampedX / rect.width) * duration;
  }

  function commitSeek(nextTime) {
    if (!audioRef.current || !(duration > 0) || !Number.isFinite(nextTime)) {
      return;
    }

    const clampedTime = Math.min(Math.max(nextTime, 0), duration);

    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }

  function handleProgressPointerDown(event) {
    if (
      !(duration > 0) ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    const nextTime = getTimeFromClientX(event.clientX);

    setIsScrubbing(true);
    setScrubTime(nextTime);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }

  function handleProgressPointerMove(event) {
    if (!isScrubbing || !(duration > 0)) {
      return;
    }

    setScrubTime(getTimeFromClientX(event.clientX));
  }

  function endScrub(event, shouldCommit = true) {
    if (!isScrubbing) {
      return;
    }

    const nextTime =
      shouldCommit && Number.isFinite(event?.clientX)
        ? getTimeFromClientX(event.clientX)
        : scrubTime;

    if (shouldCommit && Number.isFinite(nextTime)) {
      commitSeek(nextTime);
    }

    if (
      event?.currentTarget &&
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }

    setIsScrubbing(false);
    setScrubTime(null);
  }

  function handleProgressKeyDown(event) {
    if (!(duration > 0)) {
      return;
    }

    let nextTime = currentTime;

    if (event.key === "ArrowRight") {
      nextTime += 5;
    } else if (event.key === "ArrowLeft") {
      nextTime -= 5;
    } else if (event.key === "PageUp") {
      nextTime += 10;
    } else if (event.key === "PageDown") {
      nextTime -= 10;
    } else if (event.key === "Home") {
      nextTime = 0;
    } else if (event.key === "End") {
      nextTime = duration;
    } else {
      return;
    }

    event.preventDefault();
    commitSeek(nextTime);
  }

  function handleVolumeChange(event) {
    const audioElement = audioRef.current;
    const rawValue = Number(event.target.value);
    const nextVolume = clampVolumePercent(rawValue);

    setVolume(nextVolume);

    if (!audioElement) {
      return;
    }

    audioElement.volume = nextVolume / 100;

    if (audioElement.muted && nextVolume > 0) {
      audioElement.muted = false;
    }

    if (!audioElement.muted && nextVolume === 0) {
      audioElement.muted = true;
    }
  }

  function handleToggleMute() {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.muted = !audioElement.muted;
  }

  function getQueueTrackTitle(track) {
    if (!track || typeof track !== "object") {
      return "Unknown Track";
    }

    return (
      track.title ||
      track.display_title ||
      track.scanned_title ||
      track.file_name ||
      "Unknown Track"
    );
  }

  function getQueueTrackArtist(track) {
    if (!track || typeof track !== "object") {
      return "Unknown Artist";
    }

    return (
      track.artist ||
      track.display_artist ||
      track.scanned_artist ||
      "Unknown Artist"
    );
  }

  function handleQueueItemClick(index) {
    if (
      !canJumpQueue ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= queueItems.length
    ) {
      return;
    }

    playQueue(queueItems, index);
  }

  if (!currentTrack) {
    return (
      <main className="player-page player-page--empty" style={playerThemeVars}>
        <section className="player-page__card player-page__card--empty">
          <div className="player-page__topbar">
            <button
              type="button"
              className="player-page__back-button"
              onClick={handleBackNavigation}
              aria-label="Go back"
            >
              <ArrowLeft
                className="player-page__icon player-page__icon--back"
                aria-hidden="true"
              />
            </button>
          </div>
          <p className="player-page__eyebrow">Player</p>
          <h1 className="player-page__title">Nothing Playing</h1>
          <p className="player-page__subtitle">
            Select a track from your library or playlist to start playback.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="player-page" style={playerThemeVars}>
      <section className="player-page__card" aria-labelledby="player-title">
        <div className="player-page__topbar">
          <button
            type="button"
            className="player-page__back-button"
            onClick={handleBackNavigation}
            aria-label="Go back"
          >
            <ArrowLeft
              className="player-page__icon player-page__icon--back"
              aria-hidden="true"
            />
          </button>
        </div>
        <p className="player-page__eyebrow">Now Playing</p>

        <div className="player-page__art" aria-hidden="true">
          <div className="player-page__art-disc"></div>
        </div>

        <div className="player-page__meta">
          <h1 id="player-title" className="player-page__title">
            {currentTrack.title}
          </h1>
          <p className="player-page__artist">
            {currentTrack.artist || "Unknown Artist"}
          </p>
          <p className="player-page__queue-meta">
            Track {currentIndex + 1} of {queueItems.length}
          </p>
        </div>

        <div className="player-page__progress">
          <div className="player-page__progress-inner">
            <div
              ref={progressBarRef}
              className={`player-page__progress-track${
                duration > 0 ? "" : " player-page__progress-track--disabled"
              }`}
              role="slider"
              tabIndex={duration > 0 ? 0 : -1}
              aria-label="Playback position"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration > 0 ? duration : 0)}
              aria-valuenow={Math.floor(effectiveCurrentTime)}
              aria-valuetext={`${formattedCurrentTime} of ${formattedDuration}`}
              onPointerDown={handleProgressPointerDown}
              onPointerMove={handleProgressPointerMove}
              onPointerUp={(event) => endScrub(event)}
              onPointerCancel={(event) => endScrub(event, false)}
              onKeyDown={handleProgressKeyDown}
            >
              <div
                className="player-page__progress-fill"
                style={{ width: `${progressPercent}%` }}
              ></div>
              <div
                className="player-page__progress-thumb"
                style={{ left: `${progressPercent}%` }}
                aria-hidden="true"
              ></div>
            </div>
            <div className="player-page__progress-labels">
              <span className="player-page__time player-page__time--current">
                {formattedCurrentTime}
              </span>
              <span className="player-page__time player-page__time--total">
                {formattedDuration}
              </span>
            </div>
          </div>
        </div>

        <div
          className="player-page__controls"
          role="group"
          aria-label="Playback controls"
        >
          <button
            type="button"
            className={`player-page__control player-page__control--mode${
              shuffleEnabled ? " player-page__control--active" : ""
            }`}
            onClick={toggleShuffle}
            aria-pressed={shuffleEnabled}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="player-page__icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="player-page__control player-page__control--secondary"
            onClick={previousTrack}
            aria-label="Previous track"
          >
            <SkipBack className="player-page__icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="player-page__control player-page__control--primary"
            onClick={togglePlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
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
            onClick={nextTrack}
            aria-label="Next track"
          >
            <SkipForward className="player-page__icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`player-page__control player-page__control--mode player-page__control--repeat${
              repeatMode !== "off" ? " player-page__control--active" : ""
            }${
              repeatMode === "track"
                ? " player-page__control--repeat-one"
                : repeatMode === "playlist"
                  ? " player-page__control--repeat-all"
                  : ""
            }`}
            onClick={cycleRepeatMode}
            aria-label={`Repeat mode: ${repeatMode}`}
          >
            <span className="player-page__repeat-icon-wrap" aria-hidden="true">
              <Repeat className="player-page__icon" />
              {repeatMode === "track" && (
                <span className="player-page__repeat-badge">1</span>
              )}
            </span>
          </button>
        </div>

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

                if (isInteractive) {
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      className={`player-page__queue-item${
                        isCurrent ? " player-page__queue-item--current" : ""
                      }`}
                      onClick={() => handleQueueItemClick(index)}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <span className="player-page__queue-position">
                        {index + 1}
                      </span>
                      <span className="player-page__queue-text">
                        <span className="player-page__queue-title">
                          {getQueueTrackTitle(track)}
                        </span>
                        <span className="player-page__queue-artist">
                          {getQueueTrackArtist(track)}
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
                    <span className="player-page__queue-position">
                      {index + 1}
                    </span>
                    <span className="player-page__queue-text">
                      <span className="player-page__queue-title">
                        {getQueueTrackTitle(track)}
                      </span>
                      <span className="player-page__queue-artist">
                        {getQueueTrackArtist(track)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="player-page__volume" aria-label="Volume controls">
          <button
            type="button"
            className="player-page__volume-button"
            onClick={handleToggleMute}
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

        <div className="player-page__utility">
          <button
            type="button"
            className="player-page__utility-button"
            onClick={stop}
            aria-label="Stop playback"
          >
            <Square
              className="player-page__icon player-page__icon--utility"
              aria-hidden="true"
            />
          </button>
        </div>

        <audio
          ref={audioRef}
          src={getStreamUrl(currentTrack)}
          autoPlay
          onEnded={handleEnded}
          preload="metadata"
        />
      </section>
    </main>
  );
}
