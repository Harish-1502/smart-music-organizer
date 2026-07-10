import {
  ArrowLeft,
  Square,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getTrackArtPath } from "../../../api/apiBase";
import useAuthenticatedBlobUrl from "../../../shared/hooks/useAuthenticatedBlobUrl";
import { maskTrack, shouldHideDemoArtwork } from "../../../utils/demoMode";

import PlayerNowPlayingCard from "../components/PlayerNowPlayingCard";
import PlayerQueuePanel from "../components/PlayerQueuePanel";
import PlayerTransportControls from "../components/PlayerTransportControls";
import PlayerVolumeControls from "../components/PlayerVolumeControls";
import { usePlayer } from "../context/PlayerContext";
import { useAudioTransportState } from "../hooks/useAudioTransportState";
import { usePlayerProgressState } from "../hooks/usePlayerProgressState";
import {
  getTrackDisplayAlbum,
  getTrackDisplayArtist,
  getTrackDisplayFileName,
  getTrackDisplayTitle,
} from "../utils/trackDisplay";

import "../styles/PlayerPage.css";

export default function PlayerPage() {
  const navigate = useNavigate();
  const {
    audioRef,
    artworkUrl: offlineArtworkUrl,
    currentTrack,
    currentIndex,
    queue,
    playQueue,
    isPlaying,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    nextTrack,
    previousTrack,
    stop,
    volume,
    isMuted,
    setVolumeLevel,
    toggleMute,
    seekTo,
    seekBy,
    toggleShuffle,
    cycleRepeatMode,
    streamError,
    playbackError,
    reportPlaybackError,
    clearPlaybackError,
  } = usePlayer();
  const {
    isLoading,
    transportDisabled,
    playerStatus,
    handleTogglePlayback,
  } = useAudioTransportState({
    audioRef,
    currentTrack,
    streamError,
    playbackError,
    reportPlaybackError,
    clearPlaybackError,
    togglePlayPause,
  });
  const {
    progressBarRef,
    duration,
    effectiveCurrentTime,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    seekDisabled,
    handleProgressPointerDown,
    handleProgressPointerMove,
    endScrub,
    handleProgressKeyDown,
  } = usePlayerProgressState({
    audioRef,
    currentTrack,
    seekTo,
    seekBy,
    transportDisabled,
  });
  const queueItems = Array.isArray(queue) ? queue : [];
  const hasQueueItems = queueItems.length > 0;
  const canJumpQueue = typeof playQueue === "function" && hasQueueItems;
  const displayCurrentTrack = maskTrack(currentTrack, currentIndex);
  const displayTitle = getTrackDisplayTitle(displayCurrentTrack);
  const displayArtist = getTrackDisplayArtist(displayCurrentTrack);
  const displayAlbum = getTrackDisplayAlbum(displayCurrentTrack);
  const displayFileName = getTrackDisplayFileName(displayCurrentTrack);
  const currentTrackId = currentTrack?.track_id ?? currentTrack?.id ?? null;
  const artPath =
    shouldHideDemoArtwork() || !currentTrackId || currentTrack?.offline
      ? ""
      : getTrackArtPath(currentTrackId);
  const { blobUrl: artUrl } = useAuthenticatedBlobUrl(artPath, {
    enabled: Boolean(artPath),
  });
  const resolvedArtUrl = offlineArtworkUrl || artUrl;

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

        <PlayerNowPlayingCard
          isPlaying={isPlaying}
          title={displayTitle}
          artist={displayArtist}
          album={displayAlbum}
          displayFileName={displayFileName}
          artworkUrl={resolvedArtUrl}
          currentIndex={currentIndex}
          queueLength={queueItems.length}
        />

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

        <PlayerTransportControls
          isPlaying={isPlaying}
          isLoading={isLoading}
          transportDisabled={transportDisabled}
          shuffleEnabled={shuffleEnabled}
          repeatMode={repeatMode}
          onTogglePlayback={handleTogglePlayback}
          onPreviousTrack={previousTrack}
          onNextTrack={nextTrack}
          onToggleShuffle={toggleShuffle}
          onCycleRepeatMode={cycleRepeatMode}
        />

        <PlayerQueuePanel
          queueItems={queueItems}
          currentIndex={currentIndex}
          canJumpQueue={canJumpQueue}
          onSelectIndex={handleQueueItemClick}
        />

        <PlayerVolumeControls
          volume={volume}
          isMuted={isMuted}
          onSetVolumeLevel={setVolumeLevel}
          onToggleMute={toggleMute}
        />

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
