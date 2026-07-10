import { useEffect, useState } from "react";

function clampVolumePercent(value) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function usePlayerVolumeState({ audioRef, currentTrack }) {
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

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

  return {
    volume,
    setVolume,
    isMuted,
    setIsMuted,
  };
}
