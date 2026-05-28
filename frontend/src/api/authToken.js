const SESSION_STORAGE_KEY = "smart-music-organizer:api-auth-token";
const fallbackApiToken = import.meta.env.VITE_API_AUTH_TOKEN?.trim() || "";

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
      const storedToken = normalizeToken(window.sessionStorage.getItem(SESSION_STORAGE_KEY));

      if (storedToken) {
        return storedToken;
      }
    } catch {}
  }

  return fallbackApiToken;
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
  const token = getApiToken();

  if (!token || !url) {
    return url;
  }

  try {
    const resolvedUrl = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );

    resolvedUrl.searchParams.set("api_token", token);

    if (/^https?:\/\//i.test(url)) {
      return resolvedUrl.toString();
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}api_token=${encodeURIComponent(token)}`;
  }
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
