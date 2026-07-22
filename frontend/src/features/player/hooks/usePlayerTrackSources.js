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
  const DEBUG_TAG = "player-track-sources";

  function logDebug(phase, details = {}) {
    console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
  }

  function logWarn(phase, details = {}) {
    console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
  }

  useEffect(() => {
    let cancelled = false;
    let releasePlaybackSource = () => {};
    let releaseArtworkSource = () => {};

    // Clear source state before loading the next track so stale URLs and
    // errors do not leak across track changes.
    setStreamUrl("");
    setArtworkUrl("");
    setStreamError("");
    clearPlaybackError();

    if (!currentTrack) {
      logDebug("track-cleared", {});
      return () => {};
    }

    logDebug("track-load-started", {
      trackId: currentTrackId ?? currentTrack?.track_id ?? currentTrack?.id ?? null,
      offline: Boolean(currentTrack?.offline),
      hasAudioSrc: Boolean(currentTrack?.audioSrc),
      hasAudioLocalUri: Boolean(currentTrack?.audioLocalUri),
      hasAudioBlobId: Boolean(currentTrack?.audioBlobId),
    });

    // Loads playback and artwork sources for the current track and cancels the
    // result if a newer track replaces it before the async work completes.
    async function loadTrackSources() {
      try {
        const [playbackSource, artworkSource] = await Promise.all([
          resolveTrackPlaybackSource(currentTrack),
          resolveTrackArtworkSource(currentTrack),
        ]);

        releasePlaybackSource = playbackSource?.revoke ?? (() => {});
        releaseArtworkSource = artworkSource?.revoke ?? (() => {});

        if (cancelled) {
          logDebug("track-load-cancelled", {
            trackId: currentTrackId ?? currentTrack?.track_id ?? currentTrack?.id ?? null,
          });
          releasePlaybackSource();
          releaseArtworkSource();
          return;
        }

        setStreamUrl(playbackSource?.url ?? "");
        setArtworkUrl(artworkSource?.url ?? "");
        logDebug("track-load-complete", {
          trackId: currentTrackId ?? currentTrack?.track_id ?? currentTrack?.id ?? null,
          streamUrlReady: Boolean(playbackSource?.url),
          artworkUrlReady: Boolean(artworkSource?.url),
        });
      } catch (error) {
        if (!cancelled) {
          logWarn("track-load-failed", {
            trackId: currentTrackId ?? currentTrack?.track_id ?? currentTrack?.id ?? null,
            message: error instanceof Error ? error.message : "",
          });
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
