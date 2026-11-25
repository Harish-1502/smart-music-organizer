// Normalizes and sanitizes the offline playlist id, returning null for invalid or empty values.
export function normalizeOfflineId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}

export function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizePositiveInteger(value, fallback = 0) {
  const normalizedValue = Number(value);

  return Number.isFinite(normalizedValue) && normalizedValue >= 0
    ? Math.trunc(normalizedValue)
    : fallback;
}

export function normalizeDownloadStatus(value, fallback = "pending") {
  const status = normalizeText(value, fallback);

  return status || fallback;
}

export function normalizeStorageType(value, fallback = "native_file") {
  const storageType = normalizeText(value, fallback);

  return storageType || fallback;
}

export function normalizeTimestamp(value) {
  const timestamp = normalizeText(value);

  return timestamp || new Date().toISOString();
}

export function normalizeNullableText(value) {
  const normalizedValue = normalizeText(value).trim();
  return normalizedValue || null;
}

export function normalizeDurationValue(value) {
  const normalizedValue = Number(value);

  return Number.isFinite(normalizedValue) ? Math.trunc(normalizedValue) : null;
}