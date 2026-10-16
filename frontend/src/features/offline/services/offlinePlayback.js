import {
  getPlayableNativeAudioUri,
  getPlayableNativeArtworkUri,
} from "../storage/nativeMediaFileStorage";
import {
  normalizeOfflineId,
  normalizeText,
  normalizeStorageType,
} from "../storage/repository/offlineMetadataUtils";
import { isSafeMobileLocalUri } from "../storage/repository/offlineMetadata";
import { shouldUseMobileOfflineSqlite } from "../storage/repository/offlineDbHelpers";
import { getOfflineTrack } from "../storage/repository/offlineTrackRepository";
import {
  getOfflinePlaylists,
  getOfflineTracksForPlaylist,
} from "../storage/repository/offlinePlaylistRepository";

// Build a consistent offline playback record with the supplied source fields.
function buildSafePlaybackTrack(track, sourceFields = {}) {
  // Normalize the track ID and return null when no valid ID is available.
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);

  if (!trackId) {
    return null;
  }

  // Normalize display metadata, then attach the platform-specific source fields.
  return {
    id: trackId,
    title: normalizeText(track?.title, "Unknown Title"),
    artist: normalizeText(track?.artist),
    album: normalizeText(track?.album),
    duration: Number.isFinite(Number(track?.duration))
      ? Math.trunc(Number(track.duration))
      : null,
    offline: true,
    storageType: normalizeStorageType(track?.storageType, "native_file"),
    ...sourceFields,
  };
}

// Resolve a downloaded native track into audio and optional artwork URLs.
async function buildNativeOfflinePlaybackTrack(track) {
  // Reject missing or unsafe audio references before accessing native storage.
  if (!isSafeMobileLocalUri(track?.audioLocalUri)) {
    return null;
  }

  // Resolve the native audio file and return null when no playable URL is available.
  const audioSrc = await getPlayableNativeAudioUri(track.audioLocalUri);

  if (!audioSrc) {
    return null;
  }

  // Artwork is optional; a resolution failure leaves audio playback available.
  let artworkSrc = null;

  if (isSafeMobileLocalUri(track?.artworkLocalUri)) {
    try {
      artworkSrc = await getPlayableNativeArtworkUri(track.artworkLocalUri);
    } catch {
      artworkSrc = null;
    }
  }

  // Build the native playback record with resolved URLs and no browser blob IDs.
  return buildSafePlaybackTrack(track, {
    audioSrc,
    artworkSrc,
    audioBlobId: null,
    artworkBlobId: null,
  });
}

// Prepare browser playback using stored blob IDs without creating object URLs yet.
function buildBrowserOfflinePlaybackTrack(track) {
  // Require an audio blob ID before building the browser playback record.
  const audioBlobId = normalizeOfflineId(track?.audioBlobId);

  if (!audioBlobId) {
    return null;
  }

  return buildSafePlaybackTrack(track, {
    audioSrc: null,
    artworkSrc: null,
    audioBlobId,
    artworkBlobId: normalizeOfflineId(track?.artworkBlobId),
  });
}

// Read a downloaded track and select its audio source for the current storage platform.
export async function getOfflineTrackAudioSource(trackId) {
  // getOfflineTrack() reads metadata; return null when no downloaded record is found.
  const track = await getOfflineTrack(trackId);

  if (!track) {
    return null;
  }

  if (!shouldUseMobileOfflineSqlite()) {
    // Browser path: return the saved audio blob ID for later URL resolution.
    const audioBlobId = normalizeOfflineId(track?.audioBlobId);

    return audioBlobId
      ? {
          audioSrc: null,
          audioBlobId,
          storageType: "indexeddb_blob",
        }
      : null;
  }

  // Mobile path: require a safe local reference before resolving the audio file.
  if (!isSafeMobileLocalUri(track?.audioLocalUri)) {
    return null;
  }

  const audioSrc = await getPlayableNativeAudioUri(track.audioLocalUri);

  // Return the native audio source when resolution succeeds, otherwise return null.
  return audioSrc
    ? {
        audioSrc,
        audioBlobId: null,
        storageType: "native_file",
      }
    : null;
}

// Load a downloaded playlist and its ordered tracks for queue construction.
export async function getOfflinePlaylistForPlayback(playlistId) {
  // Sanitizes the playlist ID
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return null;
  }

  // Get all the playlists downloaded and tracks from a given playlist ID
  const [playlists, tracks] = await Promise.all([
    getOfflinePlaylists(),
    getOfflineTracksForPlaylist(normalizedPlaylistId),
  ]);

  // Find the playlist that match the given ID
  const playlist =
    playlists.find((entry) => entry.id === normalizedPlaylistId) ?? null;

  if (!playlist) {
    return null;
  }

  return {
    playlist,
    tracks,
  };
}

// Build an ordered offline queue and collect IDs of tracks that cannot be resolved.
export async function buildOfflinePlaybackQueue(playlistId) {
  // Get the offline playlist and its tracks for playback
  const offlinePlaylist = await getOfflinePlaylistForPlayback(playlistId);

  if (!offlinePlaylist) {
    return null;
  }

  const missingTrackIds = [];
  const playableTracks = [];

  // Checks which storage type the app is using, then attempts to find
  // the playable track. If it's not found, the track ID is added to the 
  // missing trackIDs list. If it's found then it's added to the playableTracks list.
  for (const track of offlinePlaylist.tracks) {
    const resolvedTrack = shouldUseMobileOfflineSqlite()
      ? await buildNativeOfflinePlaybackTrack(track)
      : buildBrowserOfflinePlaybackTrack(track);

    if (!resolvedTrack) {
      const missingTrackId = normalizeOfflineId(track?.id ?? track?.trackId);

      if (missingTrackId) {
        missingTrackIds.push(missingTrackId);
      }

      continue;
    }

    playableTracks.push(resolvedTrack);
  }

  // Return playable tracks in saved order and report skipped track IDs to the caller.
  return {
    playlistId: offlinePlaylist.playlist.id,
    playlistName: offlinePlaylist.playlist.name,
    totalTracks: offlinePlaylist.tracks.length,
    tracks: playableTracks,
    missingTrackIds,
  };
}
