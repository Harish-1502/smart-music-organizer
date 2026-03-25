export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) {
    return "—";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatMetadataSource(source) {
  if (source === "tag") return "Tag";
  if (source === "path") return "Path";
  if (source === "unknown") return "Unknown";
  return "—";
}

export function displayValue(value) {
  if (value == null || value === "") {
    return "—";
  }
  return value;
}