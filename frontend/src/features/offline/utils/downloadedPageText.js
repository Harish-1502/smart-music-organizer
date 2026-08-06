// Helpers for formatting storage size and type, and building confirmation
// messages used across the downloaded/offline UI.
export function formatStorageSize(totalBytes) {
  const size = Number(totalBytes);

  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** unitIndex;

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatStorageType(storageType) {
  if (storageType === "native_file") {
    return "Native files";
  }

  if (storageType === "indexeddb" || storageType === "indexeddb_blob") {
    return "IndexedDB";
  }

  return "Unknown";
}

export function formatDownloadedDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

export function buildDeleteDownloadConfirmationText(playlistName) {
  const safePlaylistName =
    typeof playlistName === "string" && playlistName.trim()
      ? playlistName.trim()
      : "this playlist";

  return `Delete the offline download for ${safePlaylistName}? Shared tracks used by other downloaded playlists will be kept.`;
}

export function buildClearAllDownloadsConfirmationText(summary) {
  return `Clear all offline downloads? This removes ${summary?.playlistCount ?? 0} playlists, ${summary?.trackCount ?? 0} tracks, and ${formatStorageSize(summary?.totalBytes ?? 0)} from ${formatStorageType(summary?.storageType)} storage.`;
}

export function getMissingAudioWarningMessage(summary) {
  const missingAudioFileCount = Number(summary?.missingAudioFileCount ?? 0);

  if (!Number.isFinite(missingAudioFileCount) || missingAudioFileCount <= 0) {
    return "";
  }

  return `${missingAudioFileCount} offline audio file${missingAudioFileCount === 1 ? "" : "s"} ${missingAudioFileCount === 1 ? "is" : "are"} missing. Play Offline will skip unavailable tracks until those downloads are refreshed.`;
}

export function sanitizeLibraryProgressTitle(value) {
  const normalizedValue =
    typeof value === "string" ? value.trim().replaceAll("\\", "/") : "";

  if (!normalizedValue) {
    return "";
  }

  if (
    /^[a-zA-Z]:\//.test(normalizedValue) ||
    normalizedValue.startsWith("//") ||
    normalizedValue.startsWith("file://") ||
    normalizedValue.startsWith("content://") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("/../")
  ) {
    return "Current track hidden for privacy.";
  }

  return normalizedValue;
}

export function buildLibraryTransferSummary(progress) {
  const verifiedExistingCount = Number(progress?.verifiedExistingCount ?? 0);
  const downloadedCount = Number(progress?.downloadedCount ?? 0);
  const skippedCount = Number(progress?.skippedCount ?? 0);
  const failedCount = Number(progress?.failedCount ?? 0);

  return `Verified existing ${verifiedExistingCount}, newly downloaded ${downloadedCount}, skipped during this run ${skippedCount}, failed ${failedCount}.`;
}
