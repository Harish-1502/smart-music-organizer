import { Capacitor } from "@capacitor/core";

export const MOBILE_OFFLINE_DB_NAME = "smart_music_organizer_mobile_offline";
export const MOBILE_OFFLINE_DB_VERSION = 1;

let sqlitePluginPromise = null;
let sqliteConnectionPromise = null;
let initialized = false;

const SCHEMA_STATEMENTS = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS offline_tracks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    album TEXT DEFAULT '',
    duration INTEGER,
    download_status TEXT NOT NULL DEFAULT 'pending',
    storage_type TEXT NOT NULL DEFAULT 'native_file',
    downloaded_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS offline_playlists (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    total_tracks INTEGER NOT NULL DEFAULT 0,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    download_status TEXT NOT NULL DEFAULT 'pending',
    storage_type TEXT NOT NULL DEFAULT 'native_file',
    downloaded_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS offline_playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_order INTEGER NOT NULL,
    downloaded_at TEXT,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES offline_playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES offline_tracks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS offline_media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    local_uri TEXT NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'native_file',
    downloaded_at TEXT,
    UNIQUE(track_id, media_type),
    FOREIGN KEY (track_id) REFERENCES offline_tracks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS offline_downloads (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    download_status TEXT NOT NULL DEFAULT 'pending',
    storage_type TEXT NOT NULL DEFAULT 'native_file',
    requested_at TEXT NOT NULL,
    downloaded_at TEXT,
    error_message TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_offline_playlist_tracks_playlist_order
    ON offline_playlist_tracks (playlist_id, track_order);

  CREATE INDEX IF NOT EXISTS idx_offline_media_files_track_type
    ON offline_media_files (track_id, media_type);

  CREATE INDEX IF NOT EXISTS idx_offline_downloads_entity
    ON offline_downloads (entity_type, entity_id);
`;

export function isNativeAndroidMobileOfflineSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function getSqliteExports() {
  if (!sqlitePluginPromise) {
    sqlitePluginPromise = import("@capacitor-community/sqlite").catch(() => null);
  }

  return sqlitePluginPromise;
}

async function createSqliteConnection() {
  if (!isNativeAndroidMobileOfflineSupported()) {
    return null;
  }

  const sqliteExports = await getSqliteExports();

  if (!sqliteExports?.CapacitorSQLite || !sqliteExports?.SQLiteConnection) {
    return null;
  }

  const sqlite = new sqliteExports.SQLiteConnection(
    sqliteExports.CapacitorSQLite,
  );

  try {
    await sqlite.checkConnectionsConsistency();
  } catch {}

  let connection = null;

  try {
    const existingConnection = await sqlite.isConnection(
      MOBILE_OFFLINE_DB_NAME,
      false,
    );

    connection = existingConnection?.result
      ? await sqlite.retrieveConnection(MOBILE_OFFLINE_DB_NAME, false)
      : await sqlite.createConnection(
          MOBILE_OFFLINE_DB_NAME,
          false,
          "no-encryption",
          MOBILE_OFFLINE_DB_VERSION,
          false,
        );

    await connection.open();
    return connection;
  } catch {
    return null;
  }
}

async function getMobileOfflineConnection() {
  if (!sqliteConnectionPromise) {
    sqliteConnectionPromise = createSqliteConnection().catch(() => null);
  }

  return sqliteConnectionPromise;
}

export async function initializeMobileOfflineDb() {
  const connection = await getMobileOfflineConnection();

  if (!connection) {
    return false;
  }

  if (initialized) {
    return true;
  }

  try {
    await connection.execute(SCHEMA_STATEMENTS, true);
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export async function getMobileOfflineDb() {
  const ready = await initializeMobileOfflineDb();

  if (!ready) {
    return null;
  }

  return getMobileOfflineConnection();
}

