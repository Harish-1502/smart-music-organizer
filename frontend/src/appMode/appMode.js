const APP_MODE_STORAGE_KEY = "smart-music-organizer:app-mode";
export const APP_MODE_UPDATED_EVENT = "smart-music-organizer:app-mode-updated";

const DEFAULT_APP_MODE = "lan";
const VALID_APP_MODES = new Set(["lan", "offline"]);

function localStorageAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function readStoredAppMode() {
  if (!localStorageAvailable()) {
    return "";
  }

  try {
    const storedValue = window.localStorage.getItem(APP_MODE_STORAGE_KEY);
    return typeof storedValue === "string" ? storedValue.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

function writeStoredAppMode(value) {
  if (!localStorageAvailable()) {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(APP_MODE_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(APP_MODE_STORAGE_KEY);
    }
  } catch {}
}

function dispatchAppModeUpdated(mode) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(APP_MODE_UPDATED_EVENT, {
      detail: {
        mode,
      },
    }),
  );
}

export function normalizeAppMode(value) {
  const normalizedMode =
    typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!VALID_APP_MODES.has(normalizedMode)) {
    throw new Error('App mode must be either "lan" or "offline".');
  }

  return normalizedMode;
}

export function getAppMode() {
  const storedMode = readStoredAppMode();

  if (storedMode) {
    try {
      return normalizeAppMode(storedMode);
    } catch {
      writeStoredAppMode("");
    }
  }

  return DEFAULT_APP_MODE;
}

export function setAppMode(mode) {
  const normalizedMode = normalizeAppMode(mode);
  writeStoredAppMode(normalizedMode);
  dispatchAppModeUpdated(normalizedMode);
  return normalizedMode;
}

export function clearAppMode() {
  writeStoredAppMode("");
  dispatchAppModeUpdated(DEFAULT_APP_MODE);
}

export function isLanMode(mode = getAppMode()) {
  return mode === "lan";
}

export function isOfflineMode(mode = getAppMode()) {
  return mode === "offline";
}

export function subscribeToAppModeChanges(listener) {
  if (typeof listener !== "function" || typeof window === "undefined") {
    return () => {};
  }

  function notifyCurrentMode(modeOverride = null) {
    if (modeOverride) {
      try {
        listener(normalizeAppMode(modeOverride));
        return;
      } catch {}
    }

    listener(getAppMode());
  }

  function handleAppModeUpdated(event) {
    notifyCurrentMode(event?.detail?.mode ?? null);
  }

  function handleStorage(event) {
    if (event?.key !== APP_MODE_STORAGE_KEY) {
      return;
    }

    notifyCurrentMode(
      typeof event?.newValue === "string" ? event.newValue : null,
    );
  }

  window.addEventListener(APP_MODE_UPDATED_EVENT, handleAppModeUpdated);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(APP_MODE_UPDATED_EVENT, handleAppModeUpdated);
    window.removeEventListener("storage", handleStorage);
  };
}

