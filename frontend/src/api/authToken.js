const SESSION_STORAGE_KEY = "smart-music-organizer:api-auth-token";

function sessionStorageAvailable() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
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
    return normalizedToken;
  }

  try {
    if (normalizedToken) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, normalizedToken);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {}

  return normalizedToken;
}

export function clearApiToken() {
  if (!sessionStorageAvailable()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

export function getAuthHeaders() {
  const token = getApiToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function appendApiToken(url) {
  // Deprecated: media requests now use Authorization headers instead of query tokens.
  return url;
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
