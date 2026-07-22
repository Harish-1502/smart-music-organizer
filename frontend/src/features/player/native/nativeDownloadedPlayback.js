import { Capacitor, registerPlugin } from "@capacitor/core";

const NativeDownloadedPlaybackPlugin = registerPlugin("NativeDownloadedPlayback");
const DEBUG_TAG = "native-downloaded-playback";

function logDebug(phase, details = {}) {
  console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function logWarn(phase, details = {}) {
  console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value, fallback = 0) {
  const normalizedValue = Number(value);

  return Number.isFinite(normalizedValue) ? normalizedValue : fallback;
}

function normalizeNativeLocalUri(track) {
  const explicitLocalUri = normalizeText(track?.audioLocalUri);

  if (explicitLocalUri) {
    return explicitLocalUri;
  }

  const audioSrc = normalizeText(track?.audioSrc).replaceAll("\\", "/");
  if (!audioSrc) {
    return "";
  }

  if (audioSrc.startsWith("media/")) {
    return audioSrc;
  }

  const capacitorFileMarker = "/_capacitor_file_/";
  const capacitorFileIndex = audioSrc.indexOf(capacitorFileMarker);

  if (capacitorFileIndex >= 0) {
    const localPath = audioSrc.slice(
      capacitorFileIndex + capacitorFileMarker.length,
    );
    const filesMarker = "/files/";
    const filesIndex = localPath.indexOf(filesMarker);

    if (filesIndex >= 0) {
      return localPath.slice(filesIndex + filesMarker.length);
    }

    if (localPath.startsWith("media/")) {
      return localPath;
    }
  }

  return "";
}

function normalizeNativeDownloadedPlaybackTrack(track) {
  const audioLocalUri = normalizeNativeLocalUri(track);

  if (!track || !audioLocalUri) {
    return null;
  }

  return {
    ...track,
    audioLocalUri,
    audioSrc: null,
    artworkSrc: null,
    audioBlobId: null,
    artworkBlobId: null,
    duration: normalizeNumber(track?.duration, null),
    storageType: normalizeText(track?.storageType) || "native_file",
    offline: true,
  };
}

function normalizeNativeDownloadedPlaybackQueuePayload(payload) {
  const normalizedTracks = Array.isArray(payload?.tracks)
    ? payload.tracks
        .map(normalizeNativeDownloadedPlaybackTrack)
        .filter(Boolean)
    : [];

  return {
    ...payload,
    tracks: normalizedTracks,
    startIndex: Number.isInteger(payload?.startIndex) ? payload.startIndex : 0,
    autoplay: Boolean(payload?.autoplay),
    shuffleEnabled: Boolean(payload?.shuffleEnabled),
    repeatMode: normalizeText(payload?.repeatMode) || "off",
    volume:
      typeof payload?.volume === "number" && Number.isFinite(payload.volume)
        ? payload.volume
        : 1,
  };
}

export function isAndroidNativeRuntime() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isNativeDownloadedPlaybackTrack(track) {
  return Boolean(track?.offline && normalizeNativeLocalUri(track));
}

export function shouldUseNativeDownloadedPlaybackQueue(tracks) {
  return (
    isAndroidNativeRuntime() &&
    Array.isArray(tracks) &&
    tracks.length > 0 &&
    tracks.every(isNativeDownloadedPlaybackTrack)
  );
}

export async function isNativeDownloadedPlaybackAvailable() {
  if (!isAndroidNativeRuntime()) {
    logDebug("availability-skipped", { reason: "not-android" });
    return false;
  }

  try {
    const result = await NativeDownloadedPlaybackPlugin.isAvailable();
    logDebug("availability-ok", { available: Boolean(result?.available) });
    return Boolean(result?.available);
  } catch (error) {
    logWarn("availability-failed", {
      message: error instanceof Error ? error.message : "",
    });
    return false;
  }
}

export async function ensureNativeDownloadedPlaybackNotificationPermission() {
  if (!isAndroidNativeRuntime()) {
    logDebug("notification-permission-skipped", { reason: "not-android" });
    return false;
  }

  try {
    const result =
      await NativeDownloadedPlaybackPlugin.ensureNotificationPermission();
    logDebug("notification-permission-result", {
      granted: Boolean(result?.granted),
    });
    return Boolean(result?.granted);
  } catch (error) {
    logWarn("notification-permission-failed", {
      message: error instanceof Error ? error.message : "",
    });
    return false;
  }
}

export async function loadNativeDownloadedPlaybackQueue(payload) {
  if (!isAndroidNativeRuntime()) {
    throw new Error("Native downloaded playback is only available on Android.");
  }

  const normalizedPayload = normalizeNativeDownloadedPlaybackQueuePayload(
    payload,
  );

  logDebug("load-queue-requested", {
    trackCount: normalizedPayload.tracks.length,
    startIndex: normalizedPayload.startIndex,
    autoplay: normalizedPayload.autoplay,
    shuffleEnabled: normalizedPayload.shuffleEnabled,
    repeatMode: normalizedPayload.repeatMode,
  });

  const result = await NativeDownloadedPlaybackPlugin.loadQueue(
    normalizedPayload,
  );

  return {
    ...result,
    tracks: normalizedPayload.tracks,
  };
}

export async function playNativeDownloadedPlayback() {
  logDebug("play-requested", {});
  return NativeDownloadedPlaybackPlugin.play();
}

export async function pauseNativeDownloadedPlayback() {
  logDebug("pause-requested", {});
  return NativeDownloadedPlaybackPlugin.pause();
}

export async function stopNativeDownloadedPlayback() {
  logDebug("stop-requested", {});
  return NativeDownloadedPlaybackPlugin.stop();
}

export async function nextNativeDownloadedPlayback() {
  logDebug("next-requested", {});
  return NativeDownloadedPlaybackPlugin.next();
}

export async function previousNativeDownloadedPlayback() {
  logDebug("previous-requested", {});
  return NativeDownloadedPlaybackPlugin.previous();
}

export async function seekNativeDownloadedPlayback(positionMs) {
  logDebug("seek-requested", { positionMs });
  return NativeDownloadedPlaybackPlugin.seekTo({ positionMs });
}

export async function setNativeDownloadedPlaybackVolume(volume) {
  logDebug("volume-requested", { volume });
  return NativeDownloadedPlaybackPlugin.setVolume({ volume });
}

export async function setNativeDownloadedPlaybackMuted(muted) {
  logDebug("muted-requested", { muted });
  return NativeDownloadedPlaybackPlugin.setMuted({ muted });
}

export async function setNativeDownloadedPlaybackShuffleEnabled(enabled) {
  logDebug("shuffle-requested", { enabled });
  return NativeDownloadedPlaybackPlugin.setShuffleEnabled({ enabled });
}

export async function setNativeDownloadedPlaybackRepeatMode(repeatMode) {
  logDebug("repeat-mode-requested", { repeatMode });
  return NativeDownloadedPlaybackPlugin.setRepeatMode({ repeatMode });
}

export async function getNativeDownloadedPlaybackState() {
  if (!isAndroidNativeRuntime()) {
    logDebug("state-skipped", { reason: "not-android" });
    return null;
  }

  try {
    const state = await NativeDownloadedPlaybackPlugin.getState();
    logDebug("state-ok", {
      available: Boolean(state?.available),
      active: Boolean(state?.active),
      isPlaying: Boolean(state?.isPlaying),
      currentIndex: Number.isInteger(state?.currentIndex)
        ? state.currentIndex
        : -1,
      queueSize: Number.isInteger(state?.queueSize) ? state.queueSize : 0,
    });
    return state;
  } catch (error) {
    logWarn("state-failed", {
      message: error instanceof Error ? error.message : "",
    });
    return null;
  }
}

export { normalizeNativeDownloadedPlaybackTrack };
