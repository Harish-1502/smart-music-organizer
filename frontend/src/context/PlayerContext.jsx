import { createContext, useContext, useRef, useState } from "react";

const PlayerContext = createContext(null);

const API_BASE = "http://localhost:8000";

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off"); 
  // "off" | "track" | "playlist"

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : null;

  function getStreamUrl(track) {
    const trackId = track.track_id ?? track.id;
    return `${API_BASE}/tracks/${trackId}/stream`;
  }

  function playQueue(tracks, startIndex = 0) {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setIsPlaying(true);
  }

  function playTrack(track) {
    setQueue([track]);
    setCurrentIndex(0);
    setIsPlaying(true);
  }

  function togglePlayPause() {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  function stop() {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }

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

  function toggleShuffle() {
    setShuffleEnabled((prev) => !prev);
  }

  function cycleRepeatMode() {
    setRepeatMode((prev) => {
      if (prev === "off") return "track";
      if (prev === "track") return "playlist";
      return "off";
    });
  }

  function handleEnded() {
    if (repeatMode === "track") {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
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
        shuffleEnabled,
        repeatMode,

        getStreamUrl,
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