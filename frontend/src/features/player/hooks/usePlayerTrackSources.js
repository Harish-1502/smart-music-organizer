import { useEffect, useState } from "react";

import {
  resolveTrackArtworkSource,
  resolveTrackPlaybackSource,
} from "../context/playbackSourceResolver";

export function usePlayerTrackSources({
  currentTrack,
  currentTrackId,
  clearPlaybackError,
}) {
  const [streamUrl, setStreamUrl] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [streamError, setStreamError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let releasePlaybackSource = () => {};
    let releaseArtworkSource = () => {};

    setStreamUrl("");
    setArtworkUrl("");
    setStreamError("");
    clearPlaybackError();

    if (!currentTrack) {
      return () => {};
    }

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
    clearPlaybackError,
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

  return {
    streamUrl,
    artworkUrl,
    streamError,
  };
}
