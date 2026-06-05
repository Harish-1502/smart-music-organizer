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
import { getTrackArtPath } from "../api/apiBase";
import { usePlayer } from "../context/PlayerContext";
import useAuthenticatedBlobUrl from "../hooks/useAuthenticatedBlobUrl";
import { maskTrack, shouldHideDemoArtwork } from "../utils/demoMode";
import "../styles/PlayerPage.css";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function clampVolumePercent(value) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getPlaybackErrorMessage(error, audioElement) {
  const errorName =
    error && typeof error === "object" && "name" in error ? error.name : "";

  if (errorName === "NotAllowedError") {
    return "Playback was blocked by the browser.";
  }

  if (errorName === "AbortError") {
    return "Playback was interrupted before the track was ready.";
  }

  const mediaErrorCode = audioElement?.error?.code;

  if (mediaErrorCode === 2) {
    return "A network error interrupted playback.";
  }

  if (mediaErrorCode === 3) {
    return "The audio source could not be decoded.";
  }

  if (mediaErrorCode === 4) {
    return "The audio source is not supported.";
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Playback could not start. Try another track.";
}

export default function PlayerPage() {
  const navigate = useNavigate();
  const {
    audioRef,
    currentTrack,
    currentIndex,
    queue,
    playQueue,
    handleEnded,
    isPlaying,
    streamUrl,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    nextTrack,
    previousTrack,
    stop,
    toggleShuffle,
    cycleRepeatMode,
    streamError,
  } = usePlayer();
  const progressBarRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Number.isFinite(currentTrack?.duration) ? currentTrack.duration : NaN,
  );
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  useEffect(() => {
    if (!currentTrack) {
      setIsLoading(false);
      setIsBuffering(false);
      setIsAudioReady(false);
      setPlaybackError("");
      return;
    }

    const audioElement = audioRef.current;
    const hasPlaybackData = audioElement?.readyState >= 2;

    setIsLoading(!hasPlaybackData);
    setIsBuffering(false);
    setIsAudioReady(hasPlaybackData);
    setPlaybackError(
      audioElement?.error ? getPlaybackErrorMessage(null, audioElement) : "",
    );
  }, [audioRef, currentTrack]);

  useEffect(() => {
    const audioElement = audioRef.current;
    let cancelled = false;

    if (!audioElement || !currentTrack) {
      return () => {
        cancelled = true;
      };
    }

    if (isPlaying && streamUrl) {
      try {
        const playPromise = audioElement.play();

        playPromise?.catch((error) => {
          if (cancelled) {
            return;
          }

          setIsLoading(false);
          setIsBuffering(false);
          setIsAudioReady(false);
          setPlaybackError(getPlaybackErrorMessage(error, audioElement));
        });
      } catch (error) {
        if (!cancelled) {
          setIsLoading(false);
          setIsBuffering(false);
          setIsAudioReady(false);
          setPlaybackError(getPlaybackErrorMessage(error, audioElement));
        }
      }
    } else {
      audioElement.pause();
      setIsBuffering(false);
    }

    return () => {
      cancelled = true;
    };
  }, [audioRef, currentTrack, isPlaying, streamUrl]);

  useEffect(() => {
    const audioElement = audioRef.current;
    const fallbackDuration = Number.isFinite(currentTrack?.duration)
      ? currentTrack.duration
      : NaN;

    function syncProgress() {
      setCurrentTime(
        Number.isFinite(audioElement?.currentTime)
          ? audioElement.currentTime
          : 0,
      );
      setDuration(
        Number.isFinite(audioElement?.duration) && audioElement.duration > 0
          ? audioElement.duration
          : fallbackDuration,
      );
    }

    setCurrentTime(
      Number.isFinite(audioElement?.currentTime) ? audioElement.currentTime : 0,
    );
    setDuration(
      Number.isFinite(audioElement?.duration) && audioElement.duration > 0
        ? audioElement.duration
        : fallbackDuration,
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
          Number.isFinite(audioElement.volume)
            ? audioElement.volume * 100
            : 100,
        ),
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

  useEffect(() => {
    function handleGlobalKeyDown(event) {
      const activeElement = document.activeElement;
      const tag = activeElement?.tagName;

      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        activeElement?.isContentEditable ||
        activeElement?.getAttribute("role") === "slider"
      ) {
        return;
      }

      try {
        if (event.code === "Space") {
          event.preventDefault();
          togglePlayPause();
          return;
        }

        if (event.code === "ArrowRight") {
          event.preventDefault();
          nextTrack();
          return;
        }

        if (event.code === "ArrowLeft") {
          event.preventDefault();
          previousTrack();
        }
      } catch (error) {
        console.error("Player keyboard shortcut failed.", error);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [togglePlayPause, nextTrack, previousTrack]);

  const effectiveCurrentTime =
    isScrubbing && Number.isFinite(scrubTime) ? scrubTime : currentTime;

  const progressPercent =
    duration > 0 ? Math.min(100, (effectiveCurrentTime / duration) * 100) : 0;

  const formattedCurrentTime = formatTime(effectiveCurrentTime);
  const formattedDuration = duration > 0 ? formatTime(duration) : "--:--";
  const queueItems = Array.isArray(queue) ? queue : [];
  const hasQueueItems = queueItems.length > 0;
  const canJumpQueue = typeof playQueue === "function" && hasQueueItems;
  const transportDisabled =
    isLoading || !isAudioReady || Boolean(playbackError || streamError);
  const seekDisabled = transportDisabled || !(duration > 0);
  const playerStatus = playbackError || streamError
    ? playbackError || streamError
    : isBuffering
      ? "Buffering..."
      : isLoading
        ? "Loading..."
        : "";
  const displayCurrentTrack = maskTrack(currentTrack, currentIndex);
  const displayTitle = getDisplayTitle(displayCurrentTrack);
  const displayArtist = getDisplayArtist(displayCurrentTrack);
  const displayAlbum = getDisplayAlbum(displayCurrentTrack);
  const displayFileName = firstNonEmpty(displayCurrentTrack?.file_name, displayTitle);
  const currentTrackId = currentTrack?.track_id ?? currentTrack?.id ?? null;
  const artPath =
    shouldHideDemoArtwork() || !currentTrackId ? "" : getTrackArtPath(currentTrackId);
  const { blobUrl: artUrl } = useAuthenticatedBlobUrl(artPath, {
    enabled: Boolean(artPath),
  });

  const playerThemeVars = {
    ...(currentTrack?.accentColor
      ? { "--player-accent": currentTrack.accentColor }
      : {}),
    ...(currentTrack?.accentColor2
      ? { "--player-accent-2": currentTrack.accentColor2 }
      : {}),
  };
  const ambientBackground = (
    <div className="player-page__ambient" aria-hidden="true">
      <div className="player-page__spotlight"></div>
      <div className="player-page__orb player-page__orb--one"></div>
      <div className="player-page__orb player-page__orb--two"></div>
      <div className="player-page__orb player-page__orb--three"></div>
      <div className="player-page__grain"></div>
    </div>
  );

  function handleBackNavigation() {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/playlists");
  }

  function getTimeFromClientX(clientX) {
    if (seekDisabled || !progressBarRef.current) {
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
    if (!audioRef.current || seekDisabled || !Number.isFinite(nextTime)) {
      return;
    }

    const clampedTime = Math.min(Math.max(nextTime, 0), duration);

    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }

  function handleProgressPointerDown(event) {
    if (seekDisabled || (event.pointerType === "mouse" && event.button !== 0)) {
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
    if (!isScrubbing || seekDisabled) {
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
    if (seekDisabled) {
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
    return (
      firstNonEmpty(
        track?.title,
        track?.display_title,
        track?.scanned_title,
        track?.file_name,
      ) || "Untitled track"
    );
  }

  function getQueueTrackArtist(track) {
    return (
      firstNonEmpty(
        track?.artist,
        track?.display_artist,
        track?.scanned_artist,
      ) || "Unknown artist"
    );
  }

  function getDisplayTitle(track) {
    return (
      firstNonEmpty(
        track?.title,
        track?.display_title,
        track?.scanned_title,
        track?.file_name,
      ) || "Untitled track"
    );
  }

  function getDisplayArtist(track) {
    return (
      firstNonEmpty(
        track?.artist,
        track?.display_artist,
        track?.scanned_artist,
      ) || "Unknown artist"
    );
  }

  function getDisplayAlbum(track) {
    return (
      firstNonEmpty(track?.album, track?.display_album, track?.scanned_album) ||
      "Unknown album"
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

  function handleLoadStart() {
    setIsLoading(true);
    setIsBuffering(false);
    setIsAudioReady(false);
    setPlaybackError("");
  }

  function handleLoadedMetadata() {
    setIsLoading(false);
    setPlaybackError("");
  }

  function handleCanPlay() {
    setIsLoading(false);
    setIsBuffering(false);
    setIsAudioReady(true);
    setPlaybackError("");
  }

  function handleWaiting() {
    if (!playbackError) {
      setIsBuffering(true);
    }
  }

  function handlePlaying() {
    setIsLoading(false);
    setIsBuffering(false);
    setIsAudioReady(true);
    setPlaybackError("");
  }

  function handleAudioError() {
    const audioElement = audioRef.current;

    setIsLoading(false);
    setIsBuffering(false);
    setIsAudioReady(false);
    setPlaybackError(
      getPlaybackErrorMessage(
        audioElement?.error instanceof Error ? audioElement.error : null,
        audioElement,
      ),
    );
  }
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack) {
      return undefined;
    }

    audioElement.addEventListener("loadstart", handleLoadStart);
    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("canplay", handleCanPlay);
    audioElement.addEventListener("waiting", handleWaiting);
    audioElement.addEventListener("playing", handlePlaying);
    audioElement.addEventListener("error", handleAudioError);

    return () => {
      audioElement.removeEventListener("loadstart", handleLoadStart);
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("canplay", handleCanPlay);
      audioElement.removeEventListener("waiting", handleWaiting);
      audioElement.removeEventListener("playing", handlePlaying);
      audioElement.removeEventListener("error", handleAudioError);
    };
  }, [
    audioRef,
    currentTrack,
    handleLoadStart,
    handleLoadedMetadata,
    handleCanPlay,
    handleWaiting,
    handlePlaying,
    handleAudioError,
  ]);

  function handleTogglePlayback() {
    if (playbackError) {
      setPlaybackError("");
    }

    togglePlayPause();
  }

  if (!currentTrack) {
    return (
      <main className="player-page player-page--empty" style={playerThemeVars}>
        {ambientBackground}
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
    <main
      className={`player-page${isPlaying ? " player-page--playing" : ""}`}
      style={playerThemeVars}
    >
      {ambientBackground}
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

        <div
          className={`player-page__art${isPlaying ? " player-page__art--playing" : ""}`}
          aria-hidden="true"
        >
          {artUrl ? (
            <img
              className="player-page__art-image"
              src={artUrl}
              alt=""
            />
          ) : (
            <div className="player-page__art-disc"></div>
          )}
        </div>

        <div className="player-page__meta">
          <h1
            id="player-title"
            className="player-page__title"
            title={displayFileName}
          >
            {displayTitle}
          </h1>
          <p className="player-page__artist">{displayArtist}</p>
          <p className="player-page__album" title={displayAlbum}>
            {displayAlbum}
          </p>
          <p className="player-page__queue-meta">
            Track {currentIndex + 1} of {queueItems.length}
          </p>
        </div>

        {playerStatus ? (
          <p
            className={`player-page__status${
              playbackError || streamError ? " player-page__status--error" : ""
            }`}
            role={playbackError || streamError ? "alert" : "status"}
            aria-atomic="true"
          >
            {playerStatus}
          </p>
        ) : null}

        <div className="player-page__progress">
          <div className="player-page__progress-inner">
            <div
              ref={progressBarRef}
              className={`player-page__progress-track${
                seekDisabled ? " player-page__progress-track--disabled" : ""
              }`}
              role="slider"
              tabIndex={seekDisabled ? -1 : 0}
              aria-label="Playback position"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration > 0 ? duration : 0)}
              aria-valuenow={Math.floor(effectiveCurrentTime)}
              aria-valuetext={`${formattedCurrentTime} of ${formattedDuration}`}
              aria-disabled={seekDisabled}
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
            className={`player-page__control player-page__control--mode player-page__control--shuffle${
              shuffleEnabled ? " player-page__control--shuffle-active" : ""
            }`}
            onClick={toggleShuffle}
            aria-pressed={shuffleEnabled}
            aria-label={shuffleEnabled ? "Shuffle on" : "Shuffle off"}
          >
            <Shuffle className="player-page__icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="player-page__control player-page__control--secondary"
            onClick={previousTrack}
            aria-label="Previous track"
            disabled={isLoading}
          >
            <SkipBack className="player-page__icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="player-page__control player-page__control--primary"
            onClick={handleTogglePlayback}
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
            onClick={nextTrack}
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
            onClick={cycleRepeatMode}
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
                      onClick={() => handleQueueItemClick(index)}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <span className="player-page__queue-position">
                        {index + 1}
                      </span>
                      <span className="player-page__queue-text">
                        <span className="player-page__queue-title">
                          {getQueueTrackTitle(displayQueueTrack)}
                        </span>
                        <span className="player-page__queue-artist">
                          {getQueueTrackArtist(displayQueueTrack)}
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
                        {getQueueTrackTitle(displayQueueTrack)}
                      </span>
                      <span className="player-page__queue-artist">
                        {getQueueTrackArtist(displayQueueTrack)}
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
      </section>
    </main>
  );
}
