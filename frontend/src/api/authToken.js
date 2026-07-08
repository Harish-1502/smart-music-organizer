const SESSION_STORAGE_KEY = "smart-music-organizer:api-auth-token";
export const API_TOKEN_UPDATED_EVENT =
  "smart-music-organizer:api-token-updated";

function sessionStorageAvailable() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function dispatchApiTokenUpdated(configured) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(API_TOKEN_UPDATED_EVENT, {
      detail: {
        configured: Boolean(configured),
      },
    }),
  );
}

function normalizeToken(token) {
  if (typeof token !== "string") {
    return "";
  }

  return token.trim();
}

export function getApiToken() {
  if (sessionStorageAvailable()) {
    try {
      return normalizeToken(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
    } catch {}
  }

  return "";
}

export function setApiToken(token) {
  const normalizedToken = normalizeToken(token);

  if (!sessionStorageAvailable()) {
    dispatchApiTokenUpdated(Boolean(normalizedToken));
    return normalizedToken;
  }

  try {
    if (normalizedToken) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, normalizedToken);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {}

  dispatchApiTokenUpdated(Boolean(normalizedToken));

  return normalizedToken;
}

export function clearApiToken() {
  if (!sessionStorageAvailable()) {
    dispatchApiTokenUpdated(false);
    return;
  }

  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}

  dispatchApiTokenUpdated(false);
}

export function getAuthHeaders() {
  const token = getApiToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function hasRuntimeApiToken() {
  if (!sessionStorageAvailable()) {
    return false;
  }

  try {
    return Boolean(normalizeToken(window.sessionStorage.getItem(SESSION_STORAGE_KEY)));
  } catch {
    return false;
  }
} 
