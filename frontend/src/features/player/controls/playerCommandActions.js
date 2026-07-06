export function createPlayerActions(playerDeps) {
  function clampVolumePercent(value) {
    if (!Number.isFinite(value)) {
      return 100;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
  }

  // Pauses if already playing or resumes if paused.
  function togglePlayPause() {
    if (!playerDeps.audioRef.current || !playerDeps.currentTrack) return;

    if (playerDeps.isPlaying) {
      playerDeps.audioRef.current.pause();
      playerDeps.setIsPlaying(false);
    } else {
      playerDeps.setIsPlaying(true);
      playerDeps.playAudioSafely(playerDeps.audioRef.current);
    }
  }

  // Stops playback and resets the current time to 0. Used when the user reaches the end of the queue and repeat mode is off and to manually stop playback.
  function stop() {
    if (!playerDeps.audioRef.current) return;

    playerDeps.audioRef.current.pause();
    playerDeps.audioRef.current.currentTime = 0;
    playerDeps.setIsPlaying(false);
  }

  // Moves to the next track in the queue. If shuffle in enabled, it will select a track at random. If it's on repeat mode, it will reset the current index to 0 and start playing again. If it's at the end of the queue and it's not on repeat mode, it will stop playback.
  function nextTrack() {
    if (playerDeps.queue.length === 0) return;

    if (playerDeps.shuffleEnabled && playerDeps.queue.length > 1) {
      let randomIndex = playerDeps.currentIndex;

      while (randomIndex === playerDeps.currentIndex) {
        randomIndex = Math.floor(Math.random() * playerDeps.queue.length);
      }

      playerDeps.setCurrentIndex(randomIndex);
      playerDeps.setIsPlaying(true);
      return;
    }

    const nextIndex = playerDeps.currentIndex + 1;

    if (nextIndex < playerDeps.queue.length) {
      playerDeps.setCurrentIndex(nextIndex);
      playerDeps.setIsPlaying(true);
    } else if (playerDeps.repeatMode === "playlist") {
      playerDeps.setCurrentIndex(0);
      playerDeps.setIsPlaying(true);
    } else {
      stop();
    }
  }

  // It's the same as the nextTrack function but it goes to the previous track in the queue.
  function previousTrack() {
    if (playerDeps.queue.length === 0) return;

    const previousIndex = playerDeps.currentIndex - 1;

    if (previousIndex >= 0) {
      playerDeps.setCurrentIndex(previousIndex);
      playerDeps.setIsPlaying(true);
    } else if (playerDeps.repeatMode === "playlist") {
      playerDeps.setCurrentIndex(playerDeps.queue.length - 1);
      playerDeps.setIsPlaying(true);
    }
  }

  // Shuffle mode
  function toggleShuffle() {
    playerDeps.setShuffleEnabled((prev) => !prev);
  }

  // Repeat mode (off->track->playlist->off)
  function cycleRepeatMode() {
    playerDeps.setRepeatMode((prev) => {
      if (prev === "off") return "track";
      if (prev === "track") return "playlist";
      return "off";
    });
  }

  function setVolumeLevel(nextVolume) {
    const audioElement = playerDeps.audioRef.current;
    const safeVolume = clampVolumePercent(nextVolume);

    playerDeps.setVolume(safeVolume);

    if (!audioElement) {
      return;
    }

    audioElement.volume = safeVolume / 100;

    if (audioElement.muted && safeVolume > 0) {
      audioElement.muted = false;
    }

    if (!audioElement.muted && safeVolume === 0) {
      audioElement.muted = true;
    }
  }

  function adjustVolume(delta) {
    const baseVolume = Number.isFinite(playerDeps.volume) ? playerDeps.volume : 100;
    setVolumeLevel(baseVolume + delta);
  }

  function toggleMute() {
    const audioElement = playerDeps.audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.muted = !audioElement.muted;
  }

  function seekTo(nextTime) {
    const audioElement = playerDeps.audioRef.current;

    if (!audioElement || !Number.isFinite(nextTime)) {
      return;
    }

    const safeDuration =
      typeof audioElement.duration === "number" && Number.isFinite(audioElement.duration)
        ? audioElement.duration
        : null;
    const clampedTime =
      safeDuration != null
        ? Math.min(Math.max(nextTime, 0), safeDuration)
        : Math.max(nextTime, 0);

    audioElement.currentTime = clampedTime;
  }

  function seekBy(deltaSeconds) {
    const audioElement = playerDeps.audioRef.current;

    if (!audioElement || !Number.isFinite(deltaSeconds)) {
      return;
    }

    const baseTime = Number.isFinite(audioElement.currentTime)
      ? audioElement.currentTime
      : 0;
    seekTo(baseTime + deltaSeconds);
  }

  return {
    togglePlayPause,
    stop,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeatMode,
    setVolumeLevel,
    adjustVolume,
    toggleMute,
    seekTo,
    seekBy,
  };
}
