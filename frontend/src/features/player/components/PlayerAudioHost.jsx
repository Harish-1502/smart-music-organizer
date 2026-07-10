import { useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";

export default function PlayerAudioHost() {
  const {
    audioRef,
    currentTrack,
    streamUrl,
    isPlaying,
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

    if (isPlaying && streamUrl) {
      clearPlaybackError();

      try {
        const playPromise = audioElement.play();

        playPromise?.catch((error) => {
          if (cancelled) {
            return;
          }

          reportPlaybackError(error, audioElement);
          console.error("Audio playback failed:", error);
        });
      } catch (error) {
        if (!cancelled) {
          reportPlaybackError(error, audioElement);
          console.error("Audio playback failed:", error);
        }
      }
    } else {
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
    reportPlaybackError,
    streamUrl,
  ]);

  if (!currentTrack) {
    return null;
  }

  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      preload="metadata"
      onEnded={handleEnded}
    />
  );
}
