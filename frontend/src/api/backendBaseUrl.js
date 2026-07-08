import { Capacitor } from "@capacitor/core";

const BACKEND_BASE_URL_STORAGE_KEY =
  "smart-music-organizer:backend-base-url";
const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8000";

function localStorageAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function readStoredBackendBaseUrl() {
  if (!localStorageAvailable()) {
    return "";
  }

  try {
    const storedValue = window.localStorage.getItem(
      BACKEND_BASE_URL_STORAGE_KEY,
    );
    return typeof storedValue === "string" ? storedValue.trim() : "";
  } catch {
    return "";
  }
}

function writeStoredBackendBaseUrl(value) {
  if (!localStorageAvailable()) {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(BACKEND_BASE_URL_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(BACKEND_BASE_URL_STORAGE_KEY);
    }
  } catch {}
}

function normalizePathname(pathname) {
  if (typeof pathname !== "string" || pathname === "/") {
    return "";
  }

  return pathname.replace(/\/+$/, "");
}

export function isNativeAndroidRuntime() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function normalizeBackendBaseUrl(value) {
  const trimmedValue =
    typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";

  if (!trimmedValue) {
    throw new Error("Enter a backend URL to continue.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error("Backend URL must be a valid http:// or https:// URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Backend URL must start with http:// or https://.");
  }

  if (!parsedUrl.hostname) {
    throw new Error("Backend URL must include a hostname or IP address.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Backend URL must not include embedded credentials.");
  }

  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error("Backend URL must not include query strings or fragments.");
  }

  return `${parsedUrl.origin}${normalizePathname(parsedUrl.pathname)}`;
}

export function getDefaultBackendBaseUrl() {
  const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredApiBase) {
    try {
      return normalizeBackendBaseUrl(configuredApiBase);
    } catch {
      return "";
    }
  }

  if (import.meta.env.DEV && !isNativeAndroidRuntime()) {
    return DEFAULT_DEV_API_BASE;
  }

  return "";
}

export function getBackendBaseUrl() {
  const storedValue = readStoredBackendBaseUrl();

  if (storedValue) {
    try {
      return normalizeBackendBaseUrl(storedValue);
    } catch {
      writeStoredBackendBaseUrl("");
    }
  }

  return getDefaultBackendBaseUrl();
}

export function setBackendBaseUrl(value) {
  const normalizedValue = normalizeBackendBaseUrl(value);
  writeStoredBackendBaseUrl(normalizedValue);
  return normalizedValue;
}

export function clearBackendBaseUrl() {
  writeStoredBackendBaseUrl("");
}

export function hasSavedBackendBaseUrl() {
  return Boolean(readStoredBackendBaseUrl());
}
