import { useEffect, useState } from "react";

import { getPlaybackErrorMessage } from "../utils/playbackErrorMessage";

export function useAudioTransportState({
  audioRef,
  currentTrack,
  nativePlaybackMode = false,
  nativePlaybackState = null,
  streamError,
  playbackError,
  reportPlaybackError,
  clearPlaybackError,
  togglePlayPause,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Reset status when the active track changes.
  useEffect(() => {
    if (nativePlaybackMode) {
      setIsLoading(false);
      setIsBuffering(false);
      setIsAudioReady(Boolean(nativePlaybackState?.available));
      clearPlaybackError();

      return;
    }

    if (!currentTrack) {
      setIsLoading(false);
      setIsBuffering(false);
      setIsAudioReady(false);
      clearPlaybackError();
      return;
    }

    const audioElement = audioRef.current;
    const hasPlaybackData = audioElement?.readyState >= 2;

    setIsLoading(!hasPlaybackData);
    setIsBuffering(false);
    setIsAudioReady(hasPlaybackData);
    if (audioElement?.error) {
      reportPlaybackError(null, audioElement);
      return;
    }

    clearPlaybackError();
  }, [
    audioRef,
    clearPlaybackError,
    currentTrack,
    nativePlaybackMode,
    nativePlaybackState,
    reportPlaybackError,
  ]);

  // Keep transport status in sync with the real audio element.
  useEffect(() => {
    const audioElement = audioRef.current;

    if (nativePlaybackMode) {
      return undefined;
    }

    if (!audioElement || !currentTrack) {
      return undefined;
    }

    function handleLoadStart() {
      setIsLoading(true);
      setIsBuffering(false);
      setIsAudioReady(false);
      clearPlaybackError();
    }

    function handleLoadedMetadata() {
      setIsLoading(false);
      clearPlaybackError();
    }

    function handleCanPlay() {
      setIsLoading(false);
      setIsBuffering(false);
      setIsAudioReady(true);
      clearPlaybackError();
    }

    function handleWaiting() {
      setIsBuffering((currentBuffering) =>
        playbackError ? currentBuffering : true,
      );
    }

    function handlePlaying() {
      setIsLoading(false);
      setIsBuffering(false);
      setIsAudioReady(true);
      clearPlaybackError();
    }

    function handleAudioError() {
      setIsLoading(false);
      setIsBuffering(false);
      setIsAudioReady(false);
      reportPlaybackError(
        audioElement?.error instanceof Error ? audioElement.error : null,
        audioElement,
      );
    }

    audioElement.addEventListener("loadstart", handleLoadStart);
    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("canplay", handleCanPlay);
    audioElement.addEventListener("waiting", handleWaiting);
    audioElement.addEventListener("playing", handlePlaying);
    audioElement.addEventListener("error", handleAudioError);

    return () => {
      audioElement.removeEventListener("loadstart", handleLoadStart);
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("canplay", handleCanPlay);
      audioElement.removeEventListener("waiting", handleWaiting);
      audioElement.removeEventListener("playing", handlePlaying);
      audioElement.removeEventListener("error", handleAudioError);
    };
  }, [
    audioRef,
    clearPlaybackError,
    currentTrack,
    nativePlaybackMode,
    playbackError,
    reportPlaybackError,
  ]);

  const transportDisabled =
    (nativePlaybackMode
      ? !nativePlaybackState || Boolean(!nativePlaybackState.available)
      : isLoading || !isAudioReady) ||
    Boolean(playbackError || streamError || nativePlaybackState?.errorMessage);
  const playerStatus =
    nativePlaybackMode && nativePlaybackState?.errorMessage
      ? nativePlaybackState.errorMessage
      : playbackError || streamError
      ? playbackError || streamError
      : "";

  function handleTogglePlayback() {
    if (playbackError) {
      clearPlaybackError();
    }

    togglePlayPause();
  }

  return {
    isLoading,
    isBuffering,
    isAudioReady,
    playbackError,
    transportDisabled,
    playerStatus,
    handleTogglePlayback,
  };
}
