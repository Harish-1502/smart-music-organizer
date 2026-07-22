import { useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";

const DEBUG_TAG = "player-audio-host";

function logDebug(phase, details = {}) {
  console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function logWarn(phase, details = {}) {
  console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

export default function PlayerAudioHost() {
  const {
    audioRef,
    currentTrack,
    streamUrl,
    isPlaying,
    nativePlaybackMode,
    handleEnded,
    reportPlaybackError,
    clearPlaybackError,
  } = usePlayer();

  // Acts as the bridge between PlayerContext state and the browser audio
  // element, including reporting async play failures back into shared state.
  useEffect(() => {
    const audioElement = audioRef.current;
    let cancelled = false;

    if (!audioElement || !currentTrack) {
      return () => {
        cancelled = true;
      };
    }

    logDebug("effect-ran", {
      trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
      isPlaying,
      hasStreamUrl: Boolean(streamUrl),
      nativePlaybackMode: Boolean(nativePlaybackMode),
    });

    if (nativePlaybackMode) {
      logDebug("native-mode-active", {
        trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
      });
      audioElement.pause();
      return () => {
        cancelled = true;
      };
    }

    if (isPlaying && streamUrl) {
      clearPlaybackError();
      logDebug("play-attempt", {
        trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
      });

      try {
        const playPromise = audioElement.play();

        playPromise?.catch((error) => {
          if (cancelled) {
            return;
          }

          reportPlaybackError(error, audioElement);
          console.error("Audio playback failed:", error);
          logWarn("play-rejected", {
            trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
            message: error instanceof Error ? error.message : "",
          });
        });
      } catch (error) {
        if (!cancelled) {
          reportPlaybackError(error, audioElement);
          console.error("Audio playback failed:", error);
          logWarn("play-threw", {
            trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
            message: error instanceof Error ? error.message : "",
          });
        }
      }
    } else {
      logDebug("pause-requested", {
        trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
      });
      audioElement.pause();
    }

    return () => {
      cancelled = true;
    };
  }, [
    audioRef,
    clearPlaybackError,
    currentTrack,
    isPlaying,
    nativePlaybackMode,
    reportPlaybackError,
    streamUrl,
  ]);

  if (!currentTrack) {
    return null;
  }

  return (
    <audio
      ref={audioRef}
      src={nativePlaybackMode ? "" : streamUrl}
      preload="metadata"
      onEnded={() => {
        logDebug("ended", {
          trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
        });
        handleEnded();
      }}
      onError={() => {
        logWarn("audio-error", {
          trackId: currentTrack?.track_id ?? currentTrack?.id ?? null,
        });
      }}
    />
  );
}
