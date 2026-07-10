import { useCallback, useEffect, useRef, useState } from "react";

const PLAYER_SESSION_STORAGE_KEY = "smart-music-player-session";
const PLAYER_SESSION_VERSION = 2;
const MAX_PERSISTED_QUEUE_SIZE = 500;
const CURRENT_TIME_SAVE_INTERVAL_MS = 2000;

function createTrackSnapshot(track) {
  if (!track || typeof track !== "object") {
    return null;
  }

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
    audioSrc:
      track.offline && typeof track.audioSrc === "string"
        ? track.audioSrc
        : null,
    artworkSrc:
      track.offline && typeof track.artworkSrc === "string"
        ? track.artworkSrc
        : null,
    audioLocalUri:
      track.offline && typeof track.audioLocalUri === "string"
        ? track.audioLocalUri
        : null,
    artworkLocalUri:
      track.offline && typeof track.artworkLocalUri === "string"
        ? track.artworkLocalUri
        : null,
    audioBlobId:
      track.offline && typeof track.audioBlobId === "string"
        ? track.audioBlobId
        : null,
    artworkBlobId:
      track.offline && typeof track.artworkBlobId === "string"
        ? track.artworkBlobId
        : null,
  };
}

function sanitizeQueueForStorage(queue, currentIndex) {
  const normalizedQueue = Array.isArray(queue) ? queue : [];

  if (normalizedQueue.length === 0) {
    return { queueSnapshot: [], currentIndex: -1 };
  }

  if (normalizedQueue.length <= MAX_PERSISTED_QUEUE_SIZE) {
    const queueSnapshot = normalizedQueue
      .map(createTrackSnapshot)
      .filter(Boolean);

    return {
      queueSnapshot,
      currentIndex: Math.min(
        Math.max(Math.trunc(currentIndex || 0), 0),
        queueSnapshot.length - 1,
      ),
    };
  }

  const halfWindow = Math.floor(MAX_PERSISTED_QUEUE_SIZE / 2);
  let start = Math.max(
    0,
    (Number.isFinite(currentIndex) ? currentIndex : 0) - halfWindow,
  );
  let end = start + MAX_PERSISTED_QUEUE_SIZE;

  if (end > normalizedQueue.length) {
    end = normalizedQueue.length;
    start = Math.max(0, end - MAX_PERSISTED_QUEUE_SIZE);
  }

  const queueSnapshot = normalizedQueue
    .slice(start, end)
    .map(createTrackSnapshot)
    .filter(Boolean);
  const adjustedIndex = Math.min(
    Math.max(Number.isFinite(currentIndex) ? currentIndex - start : 0, 0),
    queueSnapshot.length - 1,
  );

  return {
    queueSnapshot,
    currentIndex: adjustedIndex,
  };
}

export function usePlayerSessionPersistence({
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
  isTrackPlayable,
  validRepeatModes,
}) {
  const restoredCurrentTimeRef = useRef(null);
  const lastCurrentTimeSaveRef = useRef(0);
  const hasAppliedRestoredTimeRef = useRef(false);
  const hasHydratedSessionRef = useRef(false);
  const [hasHydratedSession, setHasHydratedSession] = useState(false);

  const clearStoredSession = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
    } catch {}
  }, []);

  const saveSession = useCallback(
    (forceTime) => {
      if (typeof window === "undefined") {
        return;
      }

      if (!hasHydratedSessionRef.current) {
        return;
      }

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
    },
    [audioRef, currentIndex, queue, repeatMode, shuffleEnabled],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      hasHydratedSessionRef.current = true;
      setHasHydratedSession(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
      if (!raw) {
        return;
      }

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

      if (!validRepeatModes.has(storedRepeat)) {
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

      for (const track of storedQueue) {
        if (!track || !isTrackPlayable(track)) {
          clearStoredSession();
          return;
        }
      }

      setQueue(storedQueue);
      setCurrentIndex(
        Math.min(Math.max(Number(storedIndex), 0), storedQueue.length - 1),
      );
      setShuffleEnabled(Boolean(storedShuffle));
      setRepeatMode(storedRepeat);
      restoredCurrentTimeRef.current = Number(storedTime);
      setIsPlaying(false);
    } catch {
      clearStoredSession();
    } finally {
      hasHydratedSessionRef.current = true;
      setHasHydratedSession(true);
    }
  }, [
    clearStoredSession,
    isTrackPlayable,
    setCurrentIndex,
    setIsPlaying,
    setQueue,
    setRepeatMode,
    setShuffleEnabled,
    validRepeatModes,
  ]);

  useEffect(() => {
    if (!hasHydratedSession) {
      return;
    }

    if (queue.length === 0 || currentIndex < 0) {
      return;
    }

    saveSession();
  }, [currentIndex, hasHydratedSession, queue, saveSession]);

  useEffect(() => {
    let attached = false;
    let onLoadedMetadata;
    let onTimeUpdate;
    let onError;
    let onBeforeUnload;
    let attempts = 0;

    const tryAttach = () => {
      const audio = audioRef.current;
      if (!audio || attached) {
        return;
      }

      onLoadedMetadata = () => {
        if (
          restoredCurrentTimeRef.current != null &&
          !hasAppliedRestoredTimeRef.current
        ) {
          const restoredTime = restoredCurrentTimeRef.current;

          try {
            if (
              typeof audio.duration === "number" &&
              Number.isFinite(audio.duration)
            ) {
              audio.currentTime = Math.min(
                Math.max(0, restoredTime),
                audio.duration,
              );
            } else {
              audio.currentTime = Math.max(0, restoredTime);
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

      if (attached || attempts > 20) {
        clearInterval(interval);
      }
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
  }, [audioRef, clearStoredSession, saveSession]);
}
