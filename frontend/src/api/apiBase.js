import axios from "axios";
import { getAuthHeaders } from "./authToken";

const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8000";
export const API_AUTH_REQUIRED_EVENT = "smart-music-organizer:api-auth-required";
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const allowRawArtPathFallback =
  import.meta.env.VITE_ALLOW_RAW_ART_PATH_FALLBACK === "true" &&
  import.meta.env.VITE_EXPOSE_LOCAL_PATHS === "true";

export const API_BASE =
  configuredApiBase || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : "");

export const api = axios.create({
  baseURL: API_BASE,
});

function normalizeApiPath(path) {
  if (!path) {
    return "/";
  }

  if (isAbsoluteUrl(path)) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

api.interceptors.request.use((config) => {
  const authHeaders = getAuthHeaders();

  // console.log("[auth-debug] axios request url/path", requestUrl);
  // console.log("[auth-debug] axios request has token: yes/no", Boolean(token));
  // console.log(
  //   "[auth-debug] authorization header attached: yes/no",
  //   Boolean(authHeaders.Authorization),
  // );

  config.headers = {
    ...(config.headers || {}),
    ...authHeaders,
  };

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      // console.log("[auth-debug] received 401, clearing token");
      window.dispatchEvent(
        new CustomEvent(API_AUTH_REQUIRED_EVENT, {
          detail: {
            url: error.config?.url || null,
          },
        }),
      );
    }

    return Promise.reject(error);
  },
);

export function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

export function apiUrl(path) {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  return `${API_BASE}${normalizeApiPath(path)}`;
}

function getSafeMediaErrorMessage(status) {
  if (status === 401) {
    return "Media access requires a valid API token.";
  }

  if (status === 403) {
    return "Media access was denied.";
  }

  if (status === 404) {
    return "Media resource was not found.";
  }

  return "Unable to load protected media.";
}

export async function fetchAuthenticatedBlob(path, options = {}) {
  if (!path) {
    throw new Error("Missing media path.");
  }

  const authHeaders = getAuthHeaders();
  // console.log("[auth-debug] fetch blob url/path", path);
  // console.log("[auth-debug] fetch blob has token: yes/no", Boolean(token));
  // console.log(
  //   "[auth-debug] fetch blob authorization header attached: yes/no",
  //   Boolean(authHeaders.Authorization),
  // );

  const response = await fetch(path, {
    headers: authHeaders,
    signal: options.signal,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(API_AUTH_REQUIRED_EVENT, {
        detail: {
          url: path,
        },
      }),
    );
  }

  if (!response.ok) {
    throw new Error(getSafeMediaErrorMessage(response.status));
  }

  return response.blob();
}

export async function createAuthenticatedBlobUrl(path, options = {}) {
  const blob = await fetchAuthenticatedBlob(path, options);
  return URL.createObjectURL(blob);
}

export function getTrackStreamPath(trackId) {
  if (!trackId) {
    return "";
  }

  return apiUrl(`/tracks/${trackId}/stream`);
}

export function getTrackArtPath(trackId) {
  if (!trackId) {
    return "";
  }

  return apiUrl(`/tracks/${trackId}/art`);
}

export function getLibraryArtPath(artPath) {
  if (typeof artPath !== "string" || !artPath.trim()) {
    return "";
  }

  const normalizedPath = artPath.trim();

  if (isAbsoluteUrl(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/static/")) {
    return apiUrl(normalizedPath);
  }

  return apiUrl(`/library/art?path=${encodeURIComponent(normalizedPath)}`);
}

export function trackArtUrlForTrack(track) {
  const trackId = track?.track_id ?? track?.id;

  if (trackId) {
    return getTrackArtPath(trackId);
  }

  if (!allowRawArtPathFallback) {
    return null;
  }

  return getLibraryArtPath(track?.art_path);
}

export async function getTrackStreamBlobUrl(trackId, options = {}) {
  return createAuthenticatedBlobUrl(getTrackStreamPath(trackId), options);
}

export async function getTrackArtBlobUrl(trackId, options = {}) {
  return createAuthenticatedBlobUrl(getTrackArtPath(trackId), options);
}
