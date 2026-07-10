import { useEffect, useState } from "react";

// Storage keys for shuffle and repeat mode persistence.
const SHUFFLE_STORAGE_KEY = "smart-music-organizer:shuffle-enabled";
const REPEAT_STORAGE_KEY = "smart-music-organizer:repeat-mode";

export function usePlayerPlaybackPreferences(validRepeatModes) {
  const [shuffleEnabled, setShuffleEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.localStorage.getItem(SHUFFLE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [repeatMode, setRepeatMode] = useState(() => {
    if (typeof window === "undefined") {
      return "off";
    }

    try {
      const storedRepeatMode = window.localStorage.getItem(REPEAT_STORAGE_KEY);
      return validRepeatModes.has(storedRepeatMode) ? storedRepeatMode : "off";
    } catch {
      return "off";
    }
  });

  // Persists shuffle and repeat preferences independently of the playback
  // session so the user's mode choices survive reloads.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        SHUFFLE_STORAGE_KEY,
        shuffleEnabled ? "true" : "false",
      );
    } catch {}
  }, [shuffleEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(REPEAT_STORAGE_KEY, repeatMode);
    } catch {}
  }, [repeatMode]);

  return {
    shuffleEnabled,
    setShuffleEnabled,
    repeatMode,
    setRepeatMode,
  };
}
