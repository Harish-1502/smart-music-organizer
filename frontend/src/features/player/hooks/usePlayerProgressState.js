import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function usePlayerProgressState({
  audioRef,
  currentTrack,
  seekTo,
  seekBy,
  transportDisabled,
}) {
  const progressBarRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Number.isFinite(currentTrack?.duration) ? currentTrack.duration : NaN,
  );
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);

  // Keep time and duration in sync with the audio element.
  useEffect(() => {
    const audioElement = audioRef.current;
    const fallbackDuration = Number.isFinite(currentTrack?.duration)
      ? currentTrack.duration
      : NaN;

    function syncProgress() {
      setCurrentTime(
        Number.isFinite(audioElement?.currentTime)
          ? audioElement.currentTime
          : 0,
      );
      setDuration(
        Number.isFinite(audioElement?.duration) && audioElement.duration > 0
          ? audioElement.duration
          : fallbackDuration,
      );
    }

    setCurrentTime(
      Number.isFinite(audioElement?.currentTime) ? audioElement.currentTime : 0,
    );
    setDuration(
      Number.isFinite(audioElement?.duration) && audioElement.duration > 0
        ? audioElement.duration
        : fallbackDuration,
    );

    if (!audioElement) {
      return;
    }

    audioElement.addEventListener("timeupdate", syncProgress);
    audioElement.addEventListener("loadedmetadata", syncProgress);
    audioElement.addEventListener("durationchange", syncProgress);
    audioElement.addEventListener("emptied", syncProgress);

    return () => {
      audioElement.removeEventListener("timeupdate", syncProgress);
      audioElement.removeEventListener("loadedmetadata", syncProgress);
      audioElement.removeEventListener("durationchange", syncProgress);
      audioElement.removeEventListener("emptied", syncProgress);
    };
  }, [audioRef, currentTrack]);

  const seekDisabled = transportDisabled || !(duration > 0);
  const effectiveCurrentTime =
    isScrubbing && Number.isFinite(scrubTime) ? scrubTime : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, (effectiveCurrentTime / duration) * 100) : 0;
  const formattedCurrentTime = formatTime(effectiveCurrentTime);
  const formattedDuration = duration > 0 ? formatTime(duration) : "--:--";

  function getTimeFromClientX(clientX) {
    if (seekDisabled || !progressBarRef.current) {
      return 0;
    }

    const rect = progressBarRef.current.getBoundingClientRect();

    if (!(rect.width > 0)) {
      return 0;
    }

    const clampedX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return (clampedX / rect.width) * duration;
  }

  function commitSeek(nextTime) {
    if (seekDisabled || !Number.isFinite(nextTime)) {
      return;
    }

    const clampedTime = Math.min(Math.max(nextTime, 0), duration);

    seekTo(clampedTime);
    setCurrentTime(clampedTime);
  }

  function handleProgressPointerDown(event) {
    if (seekDisabled || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    const nextTime = getTimeFromClientX(event.clientX);

    setIsScrubbing(true);
    setScrubTime(nextTime);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }

  function handleProgressPointerMove(event) {
    if (!isScrubbing || seekDisabled) {
      return;
    }

    setScrubTime(getTimeFromClientX(event.clientX));
  }

  function endScrub(event, shouldCommit = true) {
    if (!isScrubbing) {
      return;
    }

    const nextTime =
      shouldCommit && Number.isFinite(event?.clientX)
        ? getTimeFromClientX(event.clientX)
        : scrubTime;

    if (shouldCommit && Number.isFinite(nextTime)) {
      commitSeek(nextTime);
    }

    if (
      event?.currentTarget &&
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }

    setIsScrubbing(false);
    setScrubTime(null);
  }

  function handleProgressKeyDown(event) {
    if (seekDisabled) {
      return;
    }

    let nextTime = currentTime;

    if (event.key === "ArrowRight") {
      seekBy(5);
      event.preventDefault();
      return;
    } else if (event.key === "ArrowLeft") {
      seekBy(-5);
      event.preventDefault();
      return;
    } else if (event.key === "PageUp") {
      nextTime += 10;
    } else if (event.key === "PageDown") {
      nextTime -= 10;
    } else if (event.key === "Home") {
      nextTime = 0;
    } else if (event.key === "End") {
      nextTime = duration;
    } else {
      return;
    }

    event.preventDefault();
    commitSeek(nextTime);
  }

  return {
    progressBarRef,
    duration,
    effectiveCurrentTime,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    seekDisabled,
    handleProgressPointerDown,
    handleProgressPointerMove,
    endScrub,
    handleProgressKeyDown,
  };
}
