import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  resolveTrackArtworkSource,
  resolveTrackPlaybackSource,
} from "./playbackSourceResolver";

// Shared Container for Player state and controls. Provides a single audio element for controlling the various actions (play, pause, shuffle, repeat and queue management). This is meant to be used as a top level provider in the app so all the components can access the same player state and controls. This is also persistence is handled using localStorage to save the current queue, index, and playback position. The session is restored on mount and saved on relevant state changes.
const PlayerContext = createContext(null);

// Storage keys for shuffle and repeat mode persistence
const SHUFFLE_STORAGE_KEY = "smart-music-organizer:shuffle-enabled";
const REPEAT_STORAGE_KEY = "smart-music-organizer:repeat-mode";
const VALID_REPEAT_MODES = new Set(["off", "track", "playlist"]);

// Session persistence constants and helpers
// Stores the full playback session
const PLAYER_SESSION_STORAGE_KEY = "smart-music-player-session";
// Current version of the persisted session format.
const PLAYER_SESSION_VERSION = 2;
// Max number of tracks to persist in the queue.
const MAX_PERSISTED_QUEUE_SIZE = 500;
// Used to control how often the current playback session is saved.
const CURRENT_TIME_SAVE_INTERVAL_MS = 2000; // throttle timeupdate saves

// Strips the track object down to only playback-relevant fields fir persistence.
function createTrackSnapshot(track) {
  if (!track || typeof track !== "object") return null;

  return {
    id: track.id ?? null,
    track_id: track.track_id ?? null,
    playlist_track_id: track.playlist_track_id ?? null,
    title: track.title ?? track.display_title ?? null,
    artist: track.artist ?? track.display_artist ?? null,
    album: track.album ?? null,
    duration: typeof track.duration === "number" ? track.duration : null,
    offline: Boolean(track.offline),
    storageType: track.storageType ?? null,
    audioSrc: track.offline && typeof track.audioSrc === "string" ? track.audioSrc : null,
    artworkSrc:
      track.offline && typeof track.artworkSrc === "string" ? track.artworkSrc : null,
    audioLocalUri:
      track.offline && typeof track.audioLocalUri === "string"
        ? track.audioLocalUri
        : null,
    artworkLocalUri:
      track.offline && typeof track.artworkLocalUri === "string"
        ? track.artworkLocalUri
        : null,
    audioBlobId:
      track.offline && typeof track.audioBlobId === "string" ? track.audioBlobId : null,
    artworkBlobId:
      track.offline && typeof track.artworkBlobId === "string"
        ? track.artworkBlobId
        : null,
  };
}

// Returns the track id of the track object or null if it's not available. This is used to determine if a track is playable or not.
function getPlayableTrackId(track) {
  return (track && (track.track_id ?? track.id)) || null;
}

// Make the queue safe to save to LocalStorage
function sanitizeQueueForStorage(queue, currentIndex) {
  const q = Array.isArray(queue) ? queue : [];
  // Empty queue, return empty snapshot and invalid index
  if (q.length === 0) return { queueSnapshot: [], currentIndex: -1 };

  // Save the whole queue if it's small enough (smaller than MAX_PERSISTED_QUEUE_SIZE)
  if (q.length <= MAX_PERSISTED_QUEUE_SIZE) {
    const snap = q.map(createTrackSnapshot).filter(Boolean);
    return {
      queueSnapshot: snap,
      currentIndex: Math.min(
        Math.max(Math.trunc(currentIndex || 0), 0),
        snap.length - 1,
      ),
    };
  }

  // Slice window around currentIndex to preserve the current track
  // Why? To prevent the browser from runnning out of storage which can cause it to slow down or crash. This is mean for large playlists with thousands of tracks.
  const half = Math.floor(MAX_PERSISTED_QUEUE_SIZE / 2);
  // Start of the slice window
  let start = Math.max(
    0,
    (Number.isFinite(currentIndex) ? currentIndex : 0) - half,
  );
  // End of the slice window
  let end = start + MAX_PERSISTED_QUEUE_SIZE;
  if (end > q.length) {
    end = q.length;
    start = Math.max(0, end - MAX_PERSISTED_QUEUE_SIZE);
  }
  // Create a snapshot of the sliced queue and filter out any invalid tracks
  const slice = q.slice(start, end).map(createTrackSnapshot).filter(Boolean);
  // Adjust the currentIndex to the new slice window
  const adjustedIndex = Math.min(
    Math.max(Number.isFinite(currentIndex) ? currentIndex - start : 0, 0),
    slice.length - 1,
  );
  return { queueSnapshot: slice, currentIndex: adjustedIndex };
}

// This function defines the actual playback state that the rest of the app uses.
export function PlayerProvider({ children }) {
  const audioRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(() => {
    if (typeof window === "undefined") return false;

    try {
      return window.localStorage.getItem(SHUFFLE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [repeatMode, setRepeatMode] = useState(() => {
    if (typeof window === "undefined") return "off";

    try {
      const storedRepeatMode = window.localStorage.getItem(REPEAT_STORAGE_KEY);
      return VALID_REPEAT_MODES.has(storedRepeatMode)
        ? storedRepeatMode
        : "off";
    } catch {
      return "off";
    }
  });
  // "off" | "track" | "playlist"

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : null;
  const currentTrackId = getPlayableTrackId(currentTrack);
  const [streamUrl, setStreamUrl] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [streamError, setStreamError] = useState("");

  // This is triggered whenever the current track changes. This enables to user to switch between tracks in the middle of the track by updating the currentIndex with the next or prev track.
  useEffect(() => {
    let cancelled = false;
    let releasePlaybackSource = () => {};
    let releaseArtworkSource = () => {};

    // Clear state
    setStreamUrl("");
    setArtworkUrl("");
    setStreamError("");

    if (!currentTrack) {
      return () => {};
    }

    // This function loads the playback and artwork sources for the current track. Also has a check to see a new track has been selected before the previous track has finished loading. If the new track is selected, the track that was loading will be cancelled the new track will be loaded instead.
    async function loadTrackSources() {
      try {
        const [playbackSource, artworkSource] = await Promise.all([
          resolveTrackPlaybackSource(currentTrack),
          resolveTrackArtworkSource(currentTrack),
        ]);

        releasePlaybackSource = playbackSource?.revoke ?? (() => {});
        releaseArtworkSource = artworkSource?.revoke ?? (() => {});

        if (cancelled) {
          releasePlaybackSource();
          releaseArtworkSource();
          return;
        }

        setStreamUrl(playbackSource?.url ?? "");
        setArtworkUrl(artworkSource?.url ?? "");
      } catch (error) {
        if (!cancelled) {
          setStreamError(
            error instanceof Error && error.message.trim()
              ? error.message
              : "Unable to load playback source.",
          );
        }
      }
    }

    loadTrackSources();

    return () => {
      cancelled = true;
      releasePlaybackSource();
      releaseArtworkSource();
    };
  }, [
    currentTrack,
    currentTrackId,
    currentTrack?.offline,
    currentTrack?.audioSrc,
    currentTrack?.audioLocalUri,
    currentTrack?.audioBlobId,
    currentTrack?.artworkSrc,
    currentTrack?.artworkLocalUri,
    currentTrack?.artworkBlobId,
  ]);

  // This function plays the audio element
  function playAudioSafely(audioElement) {
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
  }

  // This function sets the queue and starts playing from a chosen index
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

  // Convenience shortcut to play one track
  function playTrack(track) {
    setQueue([track]);
    setCurrentIndex(0);
    setIsPlaying(true);
  }

  // Pauses if already playing or resumes if paused.
  function togglePlayPause() {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playAudioSafely(audioRef.current);
    }
  }

  // Stops playback and resets the current time to 0. Used when the user reaches the end of the queue and repeat mode is off and to manually stop playback.
  function stop() {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }

  // Moves to the next track in the queue. If shuffle in enabled, it will select a track at random. If it's on repeat mode, it will reset the current index to 0 and start playing again. If it's at the end of the queue and it's not on repeat mode, it will stop playback.
  function nextTrack() {
    if (queue.length === 0) return;

    if (shuffleEnabled && queue.length > 1) {
      let randomIndex = currentIndex;

      while (randomIndex === currentIndex) {
        randomIndex = Math.floor(Math.random() * queue.length);
      }

      setCurrentIndex(randomIndex);
      setIsPlaying(true);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      setIsPlaying(true);
    } else if (repeatMode === "playlist") {
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      stop();
    }
  }

  // It's the same as the nextTrack function but it goes to the previous track in the queue.
  function previousTrack() {
    if (queue.length === 0) return;

    const previousIndex = currentIndex - 1;

    if (previousIndex >= 0) {
      setCurrentIndex(previousIndex);
      setIsPlaying(true);
    } else if (repeatMode === "playlist") {
      setCurrentIndex(queue.length - 1);
      setIsPlaying(true);
    }
  }

  // Shuffle mode
  function toggleShuffle() {
    setShuffleEnabled((prev) => !prev);
  }

  // Repeat mode (off->track->playlist->off)
  function cycleRepeatMode() {
    setRepeatMode((prev) => {
      if (prev === "off") return "track";
      if (prev === "track") return "playlist";
      return "off";
    });
  }

  // These next two useEffects are used to save the shuffle and repeat mode to LocalStorage when they change. This is used to persist user preference when there is no saved session.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        SHUFFLE_STORAGE_KEY,
        shuffleEnabled ? "true" : "false",
      );
    } catch {}
  }, [shuffleEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(REPEAT_STORAGE_KEY, repeatMode);
    } catch {}
  }, [repeatMode]);

  // Refs & helpers for session restore/save
  const restoredCurrentTimeRef = useRef(null);
  const lastCurrentTimeSaveRef = useRef(0);
  const hasAppliedRestoredTimeRef = useRef(false);
  // Hydration guard: prevents initial default state from overwriting a valid saved session
  // during startup. Set to true after we attempt to restore the stored session.
  const hasHydratedSessionRef = useRef(false);
  const [hasHydratedSession, setHasHydratedSession] = useState(false);

  // Clear the stored session from LocalStorage. This is used when the stored session is invalid or when playback fails for restored tracks. Used to unstuck the player in a broken state.
  function clearStoredSession() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
    } catch {}
  }

  // Saves the current queue, index, playback time, shuffle state, and repeat state in a session.
  function saveSession(forceTime) {
    if (typeof window === "undefined") return;
    // Do not write session until initial hydration/restore has completed.
    if (!hasHydratedSessionRef.current) return;

    if (!Array.isArray(queue) || queue.length === 0 || currentIndex < 0) {
      return;
    }

    try {
      const { queueSnapshot, currentIndex: persistedIndex } =
        sanitizeQueueForStorage(queue, currentIndex);

      const timeToSave =
        typeof forceTime === "number"
          ? forceTime
          : audioRef.current
            ? audioRef.current.currentTime
            : (restoredCurrentTimeRef.current ?? 0);

      const payload = {
        version: PLAYER_SESSION_VERSION,
        savedAt: Date.now(),
        queue: queueSnapshot,
        currentIndex: persistedIndex,
        currentTime: Number(timeToSave || 0),
        shuffleEnabled: !!shuffleEnabled,
        repeatMode,
      };

      window.localStorage.setItem(
        PLAYER_SESSION_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {}
  }

  // Attempt to restore a saved session on mount. If invalid, clear it.
  useEffect(() => {
    if (typeof window === "undefined") {
      hasHydratedSessionRef.current = true;
      setHasHydratedSession(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== PLAYER_SESSION_VERSION) {
        clearStoredSession();
        return;
      }

      const {
        queue: storedQueue,
        currentIndex: storedIndex,
        currentTime: storedTime,
        shuffleEnabled: storedShuffle,
        repeatMode: storedRepeat,
      } = parsed;

      if (!Array.isArray(storedQueue)) {
        clearStoredSession();
        return;
      }

      if (
        !Number.isInteger(storedIndex) ||
        storedIndex < 0 ||
        storedIndex >= storedQueue.length
      ) {
        clearStoredSession();
        return;
      }

      if (typeof storedShuffle !== "boolean") {
        clearStoredSession();
        return;
      }

      if (!VALID_REPEAT_MODES.has(storedRepeat)) {
        clearStoredSession();
        return;
      }

      if (
        !(
          typeof storedTime === "number" &&
          Number.isFinite(storedTime) &&
          storedTime >= 0
        )
      ) {
        clearStoredSession();
        return;
      }

      // Ensure every stored track has a playable id
      for (const t of storedQueue) {
        if (!t || !getPlayableTrackId(t)) {
          clearStoredSession();
          return;
        }
      }

      // Restore minimal session (do not autoplay)
      setQueue(storedQueue);
      setCurrentIndex(
        Math.min(Math.max(Number(storedIndex), 0), storedQueue.length - 1),
      );
      setShuffleEnabled(Boolean(storedShuffle));
      setRepeatMode(storedRepeat);
      restoredCurrentTimeRef.current = Number(storedTime);
      setIsPlaying(false);
    } catch (err) {
      clearStoredSession();
    } finally {
      // Mark hydration complete so save effects do not overwrite the restored session
      hasHydratedSessionRef.current = true;
      setHasHydratedSession(true);
    }
    // run once on mount
  }, []);

  // Persist session on important changes - do not run until hydration completed.
  useEffect(() => {
    if (!hasHydratedSession) return;

    if (queue.length === 0 || currentIndex < 0) {
      return;
    }

    saveSession();
  }, [hasHydratedSession, queue, currentIndex, shuffleEnabled, repeatMode]);

  // Attach audio listeners (loadedmetadata, timeupdate, error) when audio becomes available.
  useEffect(() => {
    let attached = false;
    let onLoadedMetadata, onTimeUpdate, onError, onBeforeUnload;
    let attempts = 0;

    const tryAttach = () => {
      const audio = audioRef.current;
      if (!audio || attached) return;

      onLoadedMetadata = () => {
        if (
          restoredCurrentTimeRef.current != null &&
          !hasAppliedRestoredTimeRef.current
        ) {
          const t = restoredCurrentTimeRef.current;
          try {
            if (
              typeof audio.duration === "number" &&
              Number.isFinite(audio.duration)
            ) {
              audio.currentTime = Math.min(Math.max(0, t), audio.duration);
            } else {
              audio.currentTime = Math.max(0, t);
            }
          } catch {}
          hasAppliedRestoredTimeRef.current = true;
          restoredCurrentTimeRef.current = null;
        }
      };

      onTimeUpdate = () => {
        const now = Date.now();
        if (
          !lastCurrentTimeSaveRef.current ||
          now - lastCurrentTimeSaveRef.current > CURRENT_TIME_SAVE_INTERVAL_MS
        ) {
          saveSession(audio.currentTime);
          lastCurrentTimeSaveRef.current = now;
        }
      };

      onError = () => {
        // If playback fails for restored track(s), clear stored session to avoid repeated errors.
        clearStoredSession();
      };

      onBeforeUnload = () => {
        try {
          saveSession(audio.currentTime);
        } catch {}
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("error", onError);
      window.addEventListener("beforeunload", onBeforeUnload);

      attached = true;
    };

    const interval = setInterval(() => {
      tryAttach();
      attempts += 1;
      if (attached || attempts > 20) clearInterval(interval);
    }, 200);

    return () => {
      clearInterval(interval);
      const audio = audioRef.current;
      if (audio && attached) {
        try {
          audio.removeEventListener("loadedmetadata", onLoadedMetadata);
          audio.removeEventListener("timeupdate", onTimeUpdate);
          audio.removeEventListener("error", onError);
          window.removeEventListener("beforeunload", onBeforeUnload);
        } catch {}
      }
    };
    // run once
  }, []);

  function handleEnded() {
    if (repeatMode === "track") {
      if (!audioRef.current) return;

      audioRef.current.currentTime = 0;
      setIsPlaying(true);
      playAudioSafely(audioRef.current);

      return;
    }

    nextTrack();
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
        shuffleEnabled,
        repeatMode,

        getStreamUrl: () => streamUrl,
        playQueue,
        playTrack,
        togglePlayPause,
        stop,
        nextTrack,
        previousTrack,
        toggleShuffle,
        cycleRepeatMode,
        handleEnded,
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
