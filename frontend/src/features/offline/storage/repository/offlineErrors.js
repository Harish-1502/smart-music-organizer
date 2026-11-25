import {
    formatSafeError,
    getSafeErrorMessage,
} from "../../../../utils/formatSafeError";

import {
  normalizeOfflineId,
  normalizeText,
} from "../repository/offlineMetadataUtils";


// Define recognizable failure types
export class OfflineMetadataSaveError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OfflineMetadataSaveError";
    this.code = details.code ?? null;
    this.trackId = details.trackId ?? null;
    this.trackTitle = details.trackTitle ?? "";
    this.cause = details.cause;
  }
}

export class OfflineDatabaseUnavailableError extends Error {
  constructor(
    message = "Offline database is unavailable. The phone database could not be opened.",
  ) {
    super(message);
    this.name = "OfflineDatabaseUnavailableError";
  }
}
// Construct useful track-specific errors
export function buildOfflineTrackLabel(track) {
  const trackId = normalizeOfflineId(track?.id ?? track?.trackId);
  const trackTitle = normalizeText(track?.title, "Unknown Title");

  if (trackId) {
    return `Track ${trackId}`;
  }

  return `Track ${trackTitle}`;
}

export function createOfflineMetadataSaveError(track, message, details = {}) {
  return new OfflineMetadataSaveError(
    `${buildOfflineTrackLabel(track)} could not be saved: ${message}`,
    {
      trackId: normalizeOfflineId(track?.id ?? track?.trackId),
      trackTitle: normalizeText(track?.title, "Unknown Title"),
      ...details,
    },
  );
}

// Sanitize error details
export function sanitizeSafeErrorText(value) {
  const normalizedValue =
    typeof value === "string" ? value.trim().replaceAll("\\", "/") : "";

  if (
    !normalizedValue ||
    /^[a-zA-Z]:\//.test(normalizedValue) ||
    normalizedValue.startsWith("//") ||
    normalizedValue.startsWith("file://") ||
    normalizedValue.startsWith("content://") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("/data/") ||
    normalizedValue.startsWith("/storage/") ||
    normalizedValue.startsWith("/sdcard/") ||
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("/../")
  ) {
    return "";
  }

  return normalizedValue;
}


export function sanitizeOfflineMetadataError(error, track, fallbackMessage) {
  if (error instanceof OfflineMetadataSaveError) {
    return error;
  }

  const safeCode =
    typeof error?.code === "string" || typeof error?.code === "number"
      ? String(error.code)
      : "";
  const safeMessage = sanitizeSafeErrorText(error?.message);
  const detailSuffix = [safeCode ? `code ${safeCode}` : "", safeMessage]
    .filter(Boolean)
    .join(" - ");

  return createOfflineMetadataSaveError(
    track,
    detailSuffix || getSafeErrorMessage(error, fallbackMessage),
    {
      code: safeCode || null,
      cause: error,
    },
  );
}

// Log metadata failures
export function logOfflineMetadataError(operation, track, error) {
  console.error(
    `[offline-metadata-save:error] ${JSON.stringify(
      {
        operation,
        trackId: normalizeOfflineId(
          track?.id ?? track?.trackId ?? error?.trackId,
        ),
        trackTitle: normalizeText(track?.title ?? error?.trackTitle, ""),
        error: formatSafeError(error),
      },
      null,
      2,
    )}`,
  );
}