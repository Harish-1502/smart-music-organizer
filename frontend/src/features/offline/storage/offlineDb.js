import { openDB } from "idb";

export const OFFLINE_DB_NAME = "smart-music-organizer-offline";
export const OFFLINE_DB_VERSION = 1;

export const OFFLINE_PLAYLISTS_STORE = "offline_playlists";
export const OFFLINE_TRACKS_STORE = "offline_tracks";
export const OFFLINE_AUDIO_BLOBS_STORE = "offline_audio_blobs";
export const OFFLINE_ARTWORK_BLOBS_STORE = "offline_artwork_blobs";

let offlineDatabasePromise = null;

function createOfflineDatabase() {
  return openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(OFFLINE_PLAYLISTS_STORE)) {
        database.createObjectStore(OFFLINE_PLAYLISTS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(OFFLINE_TRACKS_STORE)) {
        database.createObjectStore(OFFLINE_TRACKS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(OFFLINE_AUDIO_BLOBS_STORE)) {
        database.createObjectStore(OFFLINE_AUDIO_BLOBS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(OFFLINE_ARTWORK_BLOBS_STORE)) {
        database.createObjectStore(OFFLINE_ARTWORK_BLOBS_STORE, { keyPath: "id" });
      }
    },
  });
}

export function isOfflineStorageAvailable() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export async function getOfflineDatabase() {
  if (!isOfflineStorageAvailable()) {
    return null;
  }

  if (!offlineDatabasePromise) {
    offlineDatabasePromise = createOfflineDatabase().catch(() => null);
  }

  return offlineDatabasePromise;
}
