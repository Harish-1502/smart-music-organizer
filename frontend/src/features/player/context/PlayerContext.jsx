import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPlayerActions } from "../controls/playerCommandActions";
import { usePlayerInputControls } from "../hooks/usePlayerInputControls";
import { usePlayerPlaybackPreferences } from "../hooks/usePlayerPlaybackPreferences";
import { usePlayerSessionPersistence } from "../hooks/usePlayerSessionPersistence";
import { usePlayerTrackSources } from "../hooks/usePlayerTrackSources";
import { usePlayerVolumeState } from "../hooks/usePlayerVolumeState";
import { getPlaybackErrorMessage } from "../utils/playbackErrorMessage";

// Shared container for playback state and controls.
const PlayerContext = createContext(null);

const VALID_REPEAT_MODES = new Set(["off", "track", "playlist"]);

// Returns the track id when the item is playable.
function getPlayableTrackId(track) {
  return (track && (track.track_id ?? track.id)) || null;
}

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { shuffleEnabled, setShuffleEnabled, repeatMode, setRepeatMode } =
    usePlayerPlaybackPreferences(VALID_REPEAT_MODES);

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : null;
  const currentTrackId = getPlayableTrackId(currentTrack);
  const [playbackError, setPlaybackError] = useState("");
  const { volume, setVolume, isMuted, setIsMuted } = usePlayerVolumeState({
    audioRef,
    currentTrack,
  });

  const clearPlaybackError = useCallback(() => {
    setPlaybackError("");
  }, []);

  const reportPlaybackError = useCallback((error, audioElement) => {
    setPlaybackError(getPlaybackErrorMessage(error, audioElement));
    setIsPlaying(false);
  }, []);

  const { streamUrl, artworkUrl, streamError } = usePlayerTrackSources({
    currentTrack,
    currentTrackId,
    clearPlaybackError,
  });

  const playAudioSafely = useCallback((audioElement) => {
    if (!audioElement) {
      setIsPlaying(false);
      return;
    }

    try {
      const playPromise = audioElement.play();
      playPromise?.catch(() => {
        setIsPlaying(false);
      });
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const actions = useMemo(() => {
    return createPlayerActions({
      audioRef,
      currentTrack,
      isPlaying,
      queue,
      currentIndex,
      volume,
      shuffleEnabled,
      repeatMode,
      setIsPlaying,
      setCurrentIndex,
      setVolume,
      setIsMuted,
      setShuffleEnabled,
      setRepeatMode,
      playAudioSafely,
    });
  }, [
    audioRef,
    currentTrack,
    isPlaying,
    queue,
    currentIndex,
    volume,
    shuffleEnabled,
    repeatMode,
    playAudioSafely,
  ]);

  function playQueue(tracks, startIndex = 0) {
    const normalizedQueue = Array.isArray(tracks) ? tracks : [];

    if (normalizedQueue.length === 0) {
      setQueue([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      return;
    }

    const safeStartIndex = Number.isInteger(startIndex)
      ? Math.min(Math.max(startIndex, 0), normalizedQueue.length - 1)
      : 0;

    setQueue(normalizedQueue);
    setCurrentIndex(safeStartIndex);
    setIsPlaying(true);
  }

  function playTrack(track) {
    setQueue([track]);
    setCurrentIndex(0);
    setIsPlaying(true);
  }

  usePlayerInputControls({
    actions,
    enabled: true,
  });

  usePlayerSessionPersistence({
    audioRef,
    queue,
    currentIndex,
    shuffleEnabled,
    repeatMode,
    setQueue,
    setCurrentIndex,
    setShuffleEnabled,
    setRepeatMode,
    setIsPlaying,
    isTrackPlayable: getPlayableTrackId,
    validRepeatModes: VALID_REPEAT_MODES,
  });

  function handleEnded() {
    if (repeatMode === "track") {
      if (!audioRef.current) return;

      audioRef.current.currentTime = 0;
      setIsPlaying(true);
      playAudioSafely(audioRef.current);

      return;
    }

    actions.nextTrack();
  }

  return (
    <PlayerContext.Provider
      value={{
        audioRef,
        queue,
        currentTrack,
        currentIndex,
        isPlaying,
        streamUrl,
        artworkUrl,
        streamError,
        playbackError,
        volume,
        isMuted,
        shuffleEnabled,
        repeatMode,

        getStreamUrl: () => streamUrl,
        playQueue,
        playTrack,
        setVolumeLevel: actions.setVolumeLevel,
        toggleMute: actions.toggleMute,
        seekTo: actions.seekTo,
        seekBy: actions.seekBy,
        togglePlayPause: actions.togglePlayPause,
        stop: actions.stop,
        nextTrack: actions.nextTrack,
        previousTrack: actions.previousTrack,
        toggleShuffle: actions.toggleShuffle,
        cycleRepeatMode: actions.cycleRepeatMode,
        handleEnded,
        reportPlaybackError,
        clearPlaybackError,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error("usePlayer must be used inside PlayerProvider");
  }

  return context;
}
