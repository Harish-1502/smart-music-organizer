import axios from "axios";

const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8000";

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredApiAuthToken = import.meta.env.VITE_API_AUTH_TOKEN?.trim();

export const API_BASE =
  configuredApiBase || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : "");
export const API_AUTH_TOKEN = configuredApiAuthToken || "";

export const api = axios.create({
  baseURL: API_BASE,
  headers: API_AUTH_TOKEN
    ? {
        Authorization: `Bearer ${API_AUTH_TOKEN}`,
      }
    : undefined,
});

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function normalizeApiPath(path) {
  if (!path) {
    return "/";
  }

  if (isAbsoluteUrl(path)) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function withApiAuthToken(url) {
  if (!API_AUTH_TOKEN) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}api_token=${encodeURIComponent(API_AUTH_TOKEN)}`;
}

export function apiUrl(path) {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  return withApiAuthToken(`${API_BASE}${normalizeApiPath(path)}`);
}

export function trackStreamUrl(trackId) {
  return apiUrl(`/tracks/${trackId}/stream`);
}

export function trackArtUrl(trackId) {
  return apiUrl(`/tracks/${trackId}/art`);
}

export function libraryArtUrl(artPath) {
  if (typeof artPath !== "string" || !artPath.trim()) {
    return null;
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
    return trackArtUrl(trackId);
  }

  return libraryArtUrl(track?.art_path);
}
