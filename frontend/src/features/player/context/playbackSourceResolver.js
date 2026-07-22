import { getTrackStreamBlobUrl } from "../../../api/apiBase";
import {
  getPlayableNativeAudioUri,
  getPlayableNativeArtworkUri,
} from "../../offline/storage/nativeMediaFileStorage";
import {
  createOfflineAudioBlobUrl,
  createOfflineArtworkBlobUrl,
} from "../../offline/storage/offlineStorage";

function getPlayableTrackId(track) {
  return track?.track_id ?? track?.id ?? null;
}

function createResolvedSource(url, shouldRevoke = false) {
  return {
    url,
    revoke() {
      if (shouldRevoke && url) {
        URL.revokeObjectURL(url);
      }
    },
  };
}

const DEBUG_TAG = "playback-source-resolver";

function logDebug(phase, details = {}) {
  console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function logWarn(phase, details = {}) {
  console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}
// Return the best playable audio source for a track, in priority order
export async function resolveTrackPlaybackSource(track) {
  if (!track) {
    return createResolvedSource("", false);
  }

  if (track.offline) {
    if (typeof track.audioSrc === "string" && track.audioSrc.trim()) {
      logDebug("playback-source-selected", {
        trackId: getPlayableTrackId(track),
        source: "audioSrc",
      });
      return createResolvedSource(track.audioSrc.trim(), false);
    }

    if (typeof track.audioLocalUri === "string" && track.audioLocalUri.trim()) {
      const audioSrc = await getPlayableNativeAudioUri(
        track.audioLocalUri.trim(),
      );

      if (audioSrc) {
        logDebug("playback-source-selected", {
          trackId: getPlayableTrackId(track),
          source: "audioLocalUri",
        });
        return createResolvedSource(audioSrc, false);
      }
    }

    if (typeof track.audioBlobId === "string" && track.audioBlobId.trim()) {
      const blobUrl = await createOfflineAudioBlobUrl(track.audioBlobId.trim());

      if (blobUrl) {
        logDebug("playback-source-selected", {
          trackId: getPlayableTrackId(track),
          source: "audioBlobId",
        });
        return createResolvedSource(blobUrl, true);
      }
    }

    logWarn("playback-source-missing", {
      trackId: getPlayableTrackId(track),
    });
    throw new Error("Downloaded audio file is missing.");
  }

  const playableTrackId = getPlayableTrackId(track);

  if (!playableTrackId) {
    throw new Error("Track is missing a playable source.");
  }

  const blobUrl = await getTrackStreamBlobUrl(playableTrackId);
  logDebug("playback-source-selected", {
    trackId: playableTrackId,
    source: "online-stream",
  });
  return createResolvedSource(blobUrl, true);
}

// Same as the above function but for artwork. Returns the best playable artwork source for a track, in priority order.
export async function resolveTrackArtworkSource(track) {
  if (!track?.offline) {
    return createResolvedSource("", false);
  }

  if (typeof track.artworkSrc === "string" && track.artworkSrc.trim()) {
    logDebug("artwork-source-selected", {
      trackId: getPlayableTrackId(track),
      source: "artworkSrc",
    });
    return createResolvedSource(track.artworkSrc.trim(), false);
  }

  if (
    typeof track.artworkLocalUri === "string" &&
    track.artworkLocalUri.trim()
  ) {
    const artworkSrc = await getPlayableNativeArtworkUri(
      track.artworkLocalUri.trim(),
    );

    if (artworkSrc) {
      logDebug("artwork-source-selected", {
        trackId: getPlayableTrackId(track),
        source: "artworkLocalUri",
      });
      return createResolvedSource(artworkSrc, false);
    }
  }

  if (typeof track.artworkBlobId === "string" && track.artworkBlobId.trim()) {
    const blobUrl = await createOfflineArtworkBlobUrl(
      track.artworkBlobId.trim(),
    );

    if (blobUrl) {
      logDebug("artwork-source-selected", {
        trackId: getPlayableTrackId(track),
        source: "artworkBlobId",
      });
      return createResolvedSource(blobUrl, true);
    }
  }

  logDebug("artwork-source-missing", {
    trackId: getPlayableTrackId(track),
  });
  return createResolvedSource("", false);
}
