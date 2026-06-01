import axios from "axios";
import { appendApiToken, getAuthHeaders } from "./authToken";

const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8000";
export const API_AUTH_REQUIRED_EVENT = "smart-music-organizer:api-auth-required";
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

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

export function withApiToken(url) {
  return appendApiToken(url);
}

export function trackStreamUrl(trackId) {
  return withApiToken(apiUrl(`/tracks/${trackId}/stream`));
}

export function trackArtUrl(trackId) {
  return withApiToken(apiUrl(`/tracks/${trackId}/art`));
}

export function libraryArtUrl(artPath) {
  if (typeof artPath !== "string" || !artPath.trim()) {
    return null;
  }

  const normalizedPath = artPath.trim();

  if (isAbsoluteUrl(normalizedPath)) {
    return withApiToken(normalizedPath);
  }

  if (normalizedPath.startsWith("/static/")) {
    return withApiToken(apiUrl(normalizedPath));
  }

  return withApiToken(apiUrl(`/library/art?path=${encodeURIComponent(normalizedPath)}`));
}

export function trackArtUrlForTrack(track) {
  const trackId = track?.track_id ?? track?.id;

  if (trackId) {
    return trackArtUrl(trackId);
  }

  return null;
}