export function getPlaybackErrorMessage(error, audioElement) {
  const errorName =
    error && typeof error === "object" && "name" in error ? error.name : "";

  if (errorName === "NotAllowedError") {
    return "Playback was blocked by the browser.";
  }

  if (errorName === "AbortError") {
    return "Playback was interrupted before the track was ready.";
  }

  const mediaErrorCode = audioElement?.error?.code;

  if (mediaErrorCode === 2) {
    return "A network error interrupted playback.";
  }

  if (mediaErrorCode === 3) {
    return "The audio source could not be decoded.";
  }

  if (mediaErrorCode === 4) {
    return "The audio source is not supported.";
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Playback could not start. Try another track.";
}
