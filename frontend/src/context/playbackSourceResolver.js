import { getTrackStreamBlobUrl } from "../api/apiBase";
import {
  createOfflineAudioBlobUrl,
  createOfflineArtworkBlobUrl,
} from "../offline/offlineStorage";

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

export async function resolveTrackPlaybackSource(track) {
  if (!track) {
    return createResolvedSource("", false);
  }

  if (track.offline) {
    if (typeof track.audioSrc === "string" && track.audioSrc.trim()) {
      return createResolvedSource(track.audioSrc.trim(), false);
    }

    if (typeof track.audioBlobId === "string" && track.audioBlobId.trim()) {
      const blobUrl = await createOfflineAudioBlobUrl(track.audioBlobId.trim());

      if (blobUrl) {
        return createResolvedSource(blobUrl, true);
      }
    }

    throw new Error("Downloaded audio file is missing.");
  }

  const playableTrackId = getPlayableTrackId(track);

  if (!playableTrackId) {
    throw new Error("Track is missing a playable source.");
  }

  const blobUrl = await getTrackStreamBlobUrl(playableTrackId);
  return createResolvedSource(blobUrl, true);
}

export async function resolveTrackArtworkSource(track) {
  if (!track?.offline) {
    return createResolvedSource("", false);
  }

  if (typeof track.artworkSrc === "string" && track.artworkSrc.trim()) {
    return createResolvedSource(track.artworkSrc.trim(), false);
  }

  if (typeof track.artworkBlobId === "string" && track.artworkBlobId.trim()) {
    const blobUrl = await createOfflineArtworkBlobUrl(track.artworkBlobId.trim());

    if (blobUrl) {
      return createResolvedSource(blobUrl, true);
    }
  }

  return createResolvedSource("", false);
}
