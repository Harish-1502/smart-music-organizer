import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPlayerActions } from "../controls/playerCommandActions";
import {
  ensureNativeDownloadedPlaybackNotificationPermission,
  getNativeDownloadedPlaybackState,
  isAndroidNativeRuntime,
  loadNativeDownloadedPlaybackQueue,
  nextNativeDownloadedPlayback,
  pauseNativeDownloadedPlayback,
  playNativeDownloadedPlayback,
  previousNativeDownloadedPlayback,
  seekNativeDownloadedPlayback,
  setNativeDownloadedPlaybackMuted,
  setNativeDownloadedPlaybackRepeatMode,
  setNativeDownloadedPlaybackShuffleEnabled,
  setNativeDownloadedPlaybackVolume,
  shouldUseNativeDownloadedPlaybackQueue,
  stopNativeDownloadedPlayback,
} from "../native/nativeDownloadedPlayback";
import { usePlayerInputControls } from "../hooks/usePlayerInputControls";
import { usePlayerPlaybackPreferences } from "../hooks/usePlayerPlaybackPreferences";
import { usePlayerSessionPersistence } from "../hooks/usePlayerSessionPersistence";
import { usePlayerTrackSources } from "../hooks/usePlayerTrackSources";
import { usePlayerVolumeState } from "../hooks/usePlayerVolumeState";
import { getPlaybackErrorMessage } from "../utils/playbackErrorMessage";

// Shared container for playback state and controls. Provides a single audio
// element for controlling playback, queue navigation, shuffle/repeat, and
// session-backed player state across the app.
const PlayerContext = createContext(null);

const VALID_REPEAT_MODES = new Set(["off", "track", "playlist"]);
const DEBUG_TAG = "player-context";

// Returns the track id when the item is playable.
function getPlayableTrackId(track) {
  return (track && (track.track_id ?? track.id)) || null;
}

function logDebug(phase, details = {}) {
  console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function logWarn(phase, details = {}) {
  console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function clampVolumePercent(value) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeRepeatMode(value) {
  return VALID_REPEAT_MODES.has(value) ? value : "off";
}

function summarizeNativeQueueEligibility(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return {
      eligible: false,
      reason: "empty-queue",
    };
  }

  const firstIneligibleTrack = tracks.find((track) => !track?.offline || !(track?.audioLocalUri || track?.audioSrc));

  if (!firstIneligibleTrack) {
    return {
      eligible: true,
      reason: "eligible",
    };
  }

  return {
    eligible: false,
    reason: "track-not-native",
    trackId: getPlayableTrackId(firstIneligibleTrack),
    offline: Boolean(firstIneligibleTrack?.offline),
    hasAudioSrc: Boolean(firstIneligibleTrack?.audioSrc),
    hasAudioLocalUri: Boolean(firstIneligibleTrack?.audioLocalUri),
    hasAudioBlobId: Boolean(firstIneligibleTrack?.audioBlobId),
    storageType: firstIneligibleTrack?.storageType ?? null,
  };
}

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nativePlaybackMode, setNativePlaybackMode] = useState(false);
  const [nativePlaybackState, setNativePlaybackState] = useState(null);
  const pendingNativeSeekRef = useRef(null);
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

  const syncNativePlaybackState = useCallback(async () => {
    if (!isAndroidNativeRuntime() || !nativePlaybackMode) {
      return null;
    }

    const nativeState = await getNativeDownloadedPlaybackState();

    if (!nativeState) {
      return null;
    }

    const pendingSeek = pendingNativeSeekRef.current;
    const now = Date.now();
    let effectiveNativeState = nativeState;

    if (
      pendingSeek &&
      Number.isFinite(pendingSeek.positionMs) &&
      now - pendingSeek.startedAtMs < 3000
    ) {
      const nativePositionMs = Number(nativeState.positionMs);
      const positionDiffMs = Number.isFinite(nativePositionMs)
        ? Math.abs(nativePositionMs - pendingSeek.positionMs)
        : Number.POSITIVE_INFINITY;

      if (positionDiffMs > 750) {
        logDebug("native-seek-stale-snapshot", {
          requestedPositionMs: pendingSeek.positionMs,
          nativePositionMs: Number.isFinite(nativePositionMs)
            ? nativePositionMs
            : null,
          ageMs: now - pendingSeek.startedAtMs,
        });
        effectiveNativeState = {
          ...nativeState,
          positionMs: pendingSeek.positionMs,
          isPlaying:
            nativePlaybackState?.isPlaying != null
              ? nativePlaybackState.isPlaying
              : nativeState.isPlaying,
          updatedAtMs: now,
        };
      } else {
        pendingNativeSeekRef.current = null;
      }
    }

    if (Number.isInteger(effectiveNativeState.currentIndex)) {
      setCurrentIndex(effectiveNativeState.currentIndex);
    }

    setNativePlaybackState(effectiveNativeState);
    setIsPlaying(Boolean(effectiveNativeState.isPlaying));
    setShuffleEnabled(Boolean(nativeState.shuffleEnabled));
    setRepeatMode(normalizeRepeatMode(nativeState.repeatMode));
    setVolume(clampVolumePercent((Number(nativeState.volume) || 0) * 100));
    setIsMuted(Boolean(nativeState.muted));

    return effectiveNativeState;
  }, [
    nativePlaybackMode,
    nativePlaybackState?.isPlaying,
    setCurrentIndex,
    setIsMuted,
    setIsPlaying,
    setNativePlaybackState,
    setRepeatMode,
    setShuffleEnabled,
    setVolume,
  ]);

  // This function plays the audio element and guards against rejected play()
  // calls, which can happen when the browser blocks playback.
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

  const browserActions = useMemo(() => {
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

  const actions = useMemo(() => {
    async function syncNativeStateAfterCommand() {
      try {
        await syncNativePlaybackState();
      } catch (error) {
        logWarn("native-sync-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    async function handleNativeTogglePlayPause() {
      try {
        const nativeState = await getNativeDownloadedPlaybackState();

        if (!nativeState || !nativeState.available) {
          if (isPlaying) {
            await pauseNativeDownloadedPlayback();
            setIsPlaying(false);
          } else {
            await playNativeDownloadedPlayback();
            setIsPlaying(true);
          }

          await syncNativeStateAfterCommand();
          return;
        }

        if (nativeState.isPlaying) {
          await pauseNativeDownloadedPlayback();
          setIsPlaying(false);
        } else {
          await playNativeDownloadedPlayback();
          setIsPlaying(true);
        }

        await syncNativeStateAfterCommand();
      } catch (error) {
        logWarn("native-toggle-play-pause-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    async function handleNativeStop() {
      try {
        await stopNativeDownloadedPlayback();
        setIsPlaying(false);
        await syncNativeStateAfterCommand();
      } catch (error) {
        logWarn("native-stop-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    async function handleNativeNextTrack() {
      try {
        await nextNativeDownloadedPlayback();
        setIsPlaying(true);
        await syncNativeStateAfterCommand();
      } catch (error) {
        logWarn("native-next-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    async function handleNativePreviousTrack() {
      try {
        await previousNativeDownloadedPlayback();
        setIsPlaying(true);
        await syncNativeStateAfterCommand();
      } catch (error) {
        logWarn("native-previous-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    async function handleNativeSetVolumeLevel(nextVolume) {
      const safeVolume = clampVolumePercent(nextVolume);

      try {
        await setNativeDownloadedPlaybackVolume(safeVolume / 100);
      } catch (error) {
        logWarn("native-volume-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }

      setVolume(safeVolume);
    }

    async function handleNativeToggleMute() {
      const nextMuted = !isMuted;

      try {
        await setNativeDownloadedPlaybackMuted(nextMuted);
      } catch (error) {
        logWarn("native-mute-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }

      setIsMuted(nextMuted);
    }

    async function handleNativeAdjustVolume(delta) {
      const currentVolume = Number.isFinite(volume) ? volume : 100;
      await handleNativeSetVolumeLevel(currentVolume + delta);
    }

    async function handleNativeSeekTo(nextTime) {
      try {
        const requestedPositionMs = Math.max(0, Math.round(nextTime * 1000));
        pendingNativeSeekRef.current = {
          positionMs: requestedPositionMs,
          startedAtMs: Date.now(),
        };
        logDebug("native-seek-requested", {
          nextTimeSeconds: nextTime,
          requestedPositionMs,
          currentTrackId: currentTrackId ?? null,
        });
        setNativePlaybackState((current) =>
          current
            ? {
                ...current,
                positionMs: requestedPositionMs,
                isPlaying: current.isPlaying ?? true,
                updatedAtMs: Date.now(),
              }
            : current,
        );
        await seekNativeDownloadedPlayback(requestedPositionMs);
      } catch (error) {
        pendingNativeSeekRef.current = null;
        logWarn("native-seek-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    async function handleNativeSeekBy(deltaSeconds) {
      const nativePositionSeconds = Number.isFinite(
        nativePlaybackState?.positionMs,
      )
        ? nativePlaybackState.positionMs / 1000
        : 0;
      const baseTime = nativePlaybackMode
        ? nativePositionSeconds
        : Number.isFinite(audioRef.current?.currentTime)
          ? audioRef.current.currentTime
          : 0;

      await handleNativeSeekTo(baseTime + deltaSeconds);
    }

    async function handleNativeToggleShuffle() {
      const nextValue = !shuffleEnabled;

      try {
        await setNativeDownloadedPlaybackShuffleEnabled(nextValue);
      } catch (error) {
        logWarn("native-shuffle-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }

      setShuffleEnabled(nextValue);
    }

    async function handleNativeCycleRepeatMode() {
      const nextValue =
        repeatMode === "off" ? "track" : repeatMode === "track" ? "playlist" : "off";

      try {
        await setNativeDownloadedPlaybackRepeatMode(nextValue);
      } catch (error) {
        logWarn("native-repeat-mode-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }

      setRepeatMode(nextValue);
    }

    return {
      ...browserActions,
      togglePlayPause:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeTogglePlayPause
          : browserActions.togglePlayPause,
      stop:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeStop
          : browserActions.stop,
      nextTrack:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeNextTrack
          : browserActions.nextTrack,
      previousTrack:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativePreviousTrack
          : browserActions.previousTrack,
      toggleShuffle:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeToggleShuffle
          : browserActions.toggleShuffle,
      cycleRepeatMode:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeCycleRepeatMode
          : browserActions.cycleRepeatMode,
      setVolumeLevel:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeSetVolumeLevel
          : browserActions.setVolumeLevel,
      adjustVolume:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeAdjustVolume
          : browserActions.adjustVolume,
      toggleMute:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeToggleMute
          : browserActions.toggleMute,
      seekTo:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeSeekTo
          : browserActions.seekTo,
      seekBy:
        nativePlaybackMode && isAndroidNativeRuntime()
          ? handleNativeSeekBy
          : browserActions.seekBy,
    };
  }, [
    audioRef,
    browserActions,
    isAndroidNativeRuntime,
    isPlaying,
    isMuted,
    nativePlaybackMode,
    nativePlaybackState,
    repeatMode,
    shuffleEnabled,
    syncNativePlaybackState,
    volume,
  ]);

  // This function sets the queue and starts playing from a chosen index.
  async function playQueue(tracks, startIndex = 0) {
    const normalizedQueue = Array.isArray(tracks) ? tracks : [];
    const safeStartIndex = Number.isInteger(startIndex)
      ? Math.min(Math.max(startIndex, 0), normalizedQueue.length - 1)
      : 0;

    logDebug("play-queue-requested", {
      trackCount: normalizedQueue.length,
      startIndex: safeStartIndex,
      firstTrackId: normalizedQueue[0]?.track_id ?? normalizedQueue[0]?.id ?? null,
      firstTrackOffline: Boolean(normalizedQueue[0]?.offline),
      firstTrackHasAudioSrc: Boolean(normalizedQueue[0]?.audioSrc),
      firstTrackHasAudioLocalUri: Boolean(normalizedQueue[0]?.audioLocalUri),
      firstTrackHasAudioBlobId: Boolean(normalizedQueue[0]?.audioBlobId),
    });

    if (normalizedQueue.length === 0) {
      logWarn("play-queue-empty", {});
      setQueue([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      setNativePlaybackMode(false);
      return;
    }

    const useNativePlayback = shouldUseNativeDownloadedPlaybackQueue(
      normalizedQueue,
    );
    const nativeQueueEligibility = summarizeNativeQueueEligibility(
      normalizedQueue,
    );

    logDebug("play-queue-selected", {
      safeStartIndex,
      currentTrackId:
        normalizedQueue[safeStartIndex]?.track_id ??
        normalizedQueue[safeStartIndex]?.id ??
        null,
      useNativePlayback,
      isAndroidNativeRuntime: isAndroidNativeRuntime(),
      nativeQueueEligibility,
      firstTrackSnapshot: {
        trackId:
          normalizedQueue[0]?.track_id ?? normalizedQueue[0]?.id ?? null,
        offline: Boolean(normalizedQueue[0]?.offline),
        storageType: normalizedQueue[0]?.storageType ?? null,
        audioLocalUri: normalizedQueue[0]?.audioLocalUri ?? null,
        audioSrc: normalizedQueue[0]?.audioSrc ?? null,
        audioBlobId: normalizedQueue[0]?.audioBlobId ?? null,
      },
    });

    setQueue(normalizedQueue);
    setCurrentIndex(safeStartIndex);
    setIsPlaying(true);

    if (!useNativePlayback) {
      setNativePlaybackMode(false);
      return;
    }

    setNativePlaybackMode(true);

    try {
      logDebug("native-play-queue-starting", {
        trackCount: normalizedQueue.length,
        startIndex: safeStartIndex,
        shuffleEnabled,
        repeatMode,
        volume,
      });
      await ensureNativeDownloadedPlaybackNotificationPermission();
      logDebug("native-play-queue-permission-complete", {
        trackCount: normalizedQueue.length,
      });
      const nativeState = await loadNativeDownloadedPlaybackQueue({
        tracks: normalizedQueue,
        startIndex: safeStartIndex,
        autoplay: true,
        shuffleEnabled,
        repeatMode,
        volume: clampVolumePercent(volume) / 100,
      });

      if (nativeState && typeof nativeState === "object") {
        if (Number.isInteger(nativeState.currentIndex)) {
          setCurrentIndex(nativeState.currentIndex);
        }

        setNativePlaybackState(nativeState);
        setIsPlaying(Boolean(nativeState.isPlaying));
        setShuffleEnabled(Boolean(nativeState.shuffleEnabled));
        setRepeatMode(normalizeRepeatMode(nativeState.repeatMode));
        setVolume(
          clampVolumePercent((Number(nativeState.volume) || 0) * 100),
        );
        setIsMuted(Boolean(nativeState.muted));
        setQueue(Array.isArray(nativeState.tracks) && nativeState.tracks.length > 0 ? nativeState.tracks : normalizedQueue);
      }

      logDebug("native-play-queue-complete", {
        isPlaying: Boolean(nativeState?.isPlaying),
        currentIndex: nativeState?.currentIndex ?? null,
        trackCount: Array.isArray(nativeState?.tracks)
          ? nativeState.tracks.length
          : normalizedQueue.length,
      });
    } catch (error) {
      setNativePlaybackMode(false);
      setNativePlaybackState(null);
      logWarn("native-play-queue-failed", {
        message: error instanceof Error ? error.message : "",
      });
    }
  }

  // Convenience shortcut to play one track.
  function playTrack(track) {
    logDebug("play-track-requested", {
      trackId: track?.track_id ?? track?.id ?? null,
      offline: Boolean(track?.offline),
    });
    playQueue([track], 0);
  }

  useEffect(() => {
    if (!nativePlaybackMode || !isAndroidNativeRuntime()) {
      setNativePlaybackState(null);
      return undefined;
    }

    let cancelled = false;
    let intervalId = null;

    async function handleVisibilitySync() {
      if (cancelled) {
        return;
      }

      try {
        await syncNativePlaybackState();
      } catch (error) {
        logWarn("native-foreground-sync-failed", {
          message: error instanceof Error ? error.message : "",
        });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleVisibilitySync();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    if (document.visibilityState === "visible") {
      handleVisibilitySync();
    }

    intervalId = window.setInterval(() => {
      handleVisibilitySync();
    }, 1000);

    return () => {
      cancelled = true;
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [nativePlaybackMode, syncNativePlaybackState]);

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
    logDebug("track-ended", {
      currentTrackId: currentTrackId ?? null,
      repeatMode,
      queueLength: queue.length,
      currentIndex,
    });

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
        nativePlaybackMode,
        nativePlaybackState,

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
