import { Capacitor } from "@capacitor/core";
import { formatSafeError } from "../../../utils/formatSafeError";

export const MOBILE_OFFLINE_DB_NAME = "smart_music_organizer_mobile_offline";
export const MOBILE_OFFLINE_DB_VERSION = 1;
const MOBILE_OFFLINE_DB_FAILURE_COOLDOWN_MS = 1500;

let sqlitePluginPromise = null;
let sqliteManagerPromise = null;
let sqliteConnectionPromise = null;
let sqliteInitPromise = null;
let initialized = false;
let lastInitFailure = null;
let lastInitSuccessAt = null;

function logOfflineDbInit(phase, details = {}) {
  console.info(
    `[offline-db:init:${phase}] ${JSON.stringify(details, null, 2)}`,
  );
}

function recordInitSuccess() {
  lastInitFailure = null;
  lastInitSuccessAt = Date.now();
}

function recordInitFailure(phase, error, extra = {}) {
  const safeError = formatSafeError(error);

  lastInitFailure = {
    phase,
    at: Date.now(),
    error: safeError,
    ...extra,
  };

  logOfflineDbInit("error", {
    phase,
    ...extra,
    error: safeError,
  });
}

function getRecentFailureAgeMs() {
  if (!lastInitFailure?.at) {
    return null;
  }

  return Date.now() - lastInitFailure.at;
}

function shouldCooldownFailedInit() {
  const ageMs = getRecentFailureAgeMs();

  return (
    Number.isFinite(ageMs) &&
    ageMs >= 0 &&
    ageMs < MOBILE_OFFLINE_DB_FAILURE_COOLDOWN_MS
  );
}

export function getMobileOfflineDbDebugSnapshot() {
  return {
    supported: isNativeAndroidMobileOfflineSupported(),
    platform: Capacitor.getPlatform?.() ?? "unknown",
    initialized,
    hasPluginPromise: Boolean(sqlitePluginPromise),
    hasManagerPromise: Boolean(sqliteManagerPromise),
    hasConnectionPromise: Boolean(sqliteConnectionPromise),
    hasInitPromise: Boolean(sqliteInitPromise),
    lastInitSuccessAt,
    lastInitFailure,
  };
}

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
// Returns true if the current platform is a native Android device
// that uses the Capacitor SQlite for offline storage
export function isNativeAndroidMobileOfflineSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function getSqliteExports() {
  if (!sqlitePluginPromise) {
    sqlitePluginPromise = import("@capacitor-community/sqlite").catch(
      (error) => {
        recordInitFailure("import", error, {
          nativePlatform: Capacitor.isNativePlatform(),
          platform: Capacitor.getPlatform?.() ?? "unknown",
        });
        return null;
      },
    );
  }

  return sqlitePluginPromise;
}

function resetMobileOfflineConnectionState() {
  sqliteManagerPromise = null;
  sqliteConnectionPromise = null;
  sqliteInitPromise = null;
  initialized = false;
}

function isAlreadyOpenError(error) {
  const message =
    typeof error?.message === "string" ? error.message.toLowerCase() : "";

  return message.includes("already open");
}

async function openConnectionIfNeeded(connection) {
  try {
    await connection.open();
  } catch (error) {
    if (!isAlreadyOpenError(error)) {
      throw error;
    }
  }
}

async function verifyMobileOfflineDbConnection(connection) {
  if (!connection?.query) {
    return false;
  }

  try {
    const result = await connection.query("SELECT 1 AS ready");
    return (
      Array.isArray(result?.values) && Number(result.values?.[0]?.ready) === 1
    );
  } catch {
    return false;
  }
}

async function getSqliteManager() {
  if (!isNativeAndroidMobileOfflineSupported()) {
    return null;
  }

  if (!sqliteManagerPromise) {
    sqliteManagerPromise = (async () => {
      const sqliteExports = await getSqliteExports();

      if (!sqliteExports?.CapacitorSQLite || !sqliteExports?.SQLiteConnection) {
        recordInitFailure(
          "manager-missing-exports",
          new Error("SQLite plugin exports were unavailable."),
          {
            hasCapacitorSQLite: Boolean(sqliteExports?.CapacitorSQLite),
            hasSQLiteConnection: Boolean(sqliteExports?.SQLiteConnection),
          },
        );
        return null;
      }

      logOfflineDbInit("manager-ready", {
        hasCapacitorSQLite: true,
        hasSQLiteConnection: true,
      });
      return new sqliteExports.SQLiteConnection(sqliteExports.CapacitorSQLite);
    })().catch((error) => {
      recordInitFailure("manager-create", error);
      return null;
    });
  }

  const manager = await sqliteManagerPromise;

  if (!manager) {
    sqliteManagerPromise = null;
  }

  return manager;
}

async function createSqliteConnection() {
  if (!isNativeAndroidMobileOfflineSupported()) {
    return null;
  }

  const sqlite = await getSqliteManager();

  if (!sqlite) {
    return null;
  }

  logOfflineDbInit("start", {
    supported: true,
  });

  try {
    const consistency = await sqlite.checkConnectionsConsistency();
    logOfflineDbInit("opening", {
      consistency: consistency ?? null,
    });
  } catch (error) {
    recordInitFailure("consistency-check", error);
  }

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

    if (!connection) {
      return null;
    }

    await openConnectionIfNeeded(connection);
    logOfflineDbInit("created-or-opened", {
      usedExistingConnection: Boolean(existingConnection?.result),
    });
    return connection;
  } catch (error) {
    recordInitFailure("create-or-open", error, {
      usedExistingConnection: Boolean(existingConnection?.result),
    });
    return null;
  }
}

async function getMobileOfflineConnection() {
  if (!sqliteConnectionPromise) {
    sqliteConnectionPromise = createSqliteConnection().catch(() => null);
  }

  const connection = await sqliteConnectionPromise;

  if (!connection) {
    sqliteConnectionPromise = null;
  }

  return connection;
}

export async function initializeMobileOfflineDb() {
  if (!sqliteInitPromise) {
    sqliteInitPromise = (async () => {
      const connection = await getMobileOfflineConnection();

      if (!connection) {
        return false;
      }

      const alreadyInitialized = initialized;

      if (!initialized) {
        try {
          await connection.execute(SCHEMA_STATEMENTS, true);
          logOfflineDbInit("schema-ready", {
            version: MOBILE_OFFLINE_DB_VERSION,
          });
          initialized = true;
        } catch (error) {
          recordInitFailure("schema-or-verify", error, {
            stage: "schema",
          });
          resetMobileOfflineConnectionState();
          return false;
        }
      }

      const verified = await verifyMobileOfflineDbConnection(connection);

      if (!verified) {
        recordInitFailure(
          "schema-or-verify",
          new Error("SQLite SELECT 1 verification failed."),
          {
            stage: "verify",
          },
        );
        resetMobileOfflineConnectionState();
        return false;
      }

      recordInitSuccess();
      logOfflineDbInit("verified", {
        alreadyInitialized,
      });
      return true;
    })().finally(() => {
      sqliteInitPromise = null;
    });
  }

  try {
    return await sqliteInitPromise;
  } catch {
    resetMobileOfflineConnectionState();
    return false;
  }
}

export async function ensureMobileOfflineDbReady() {
  if (!isNativeAndroidMobileOfflineSupported()) {
    return false;
  }

  if (shouldCooldownFailedInit()) {
    logOfflineDbInit("cooldown", {
      ageMs: getRecentFailureAgeMs(),
      lastFailurePhase: lastInitFailure?.phase ?? null,
    });
    return null;
  }

  if (await initializeMobileOfflineDb()) {
    return getMobileOfflineConnection();
  }

  resetMobileOfflineConnectionState();

  if (!(await initializeMobileOfflineDb())) {
    recordInitFailure(
      "ensure",
      new Error("SQLite connection could not be initialized."),
      {
        previousFailurePhase: lastInitFailure?.phase ?? null,
      },
    );
    return null;
  }

  return getMobileOfflineConnection();
}

export async function probeMobileOfflineDbHealth({ forceRetry = false } = {}) {
  if (forceRetry) {
    resetMobileOfflineConnectionState();
  }

  const snapshot = getMobileOfflineDbDebugSnapshot();
  const result = {
    ...snapshot,
    importLoaded: false,
    managerReady: false,
    connectionReady: false,
    schemaReady: false,
    verified: false,
  };

  const sqliteExports = await getSqliteExports();
  result.importLoaded = Boolean(sqliteExports);
  result.hasCapacitorSQLite = Boolean(sqliteExports?.CapacitorSQLite);
  result.hasSQLiteConnection = Boolean(sqliteExports?.SQLiteConnection);

  const manager = await getSqliteManager();
  result.managerReady = Boolean(manager);

  const connection = await getMobileOfflineConnection();
  result.connectionReady = Boolean(connection);

  const schemaReady = await initializeMobileOfflineDb();
  result.schemaReady = Boolean(schemaReady);
  result.verified = Boolean(
    schemaReady && (await getMobileOfflineConnection()),
  );
  result.lastInitFailure = lastInitFailure;
  result.lastInitSuccessAt = lastInitSuccessAt;

  logOfflineDbInit("probe", result);
  return result;
}

export async function getMobileOfflineDb() {
  const connection = await ensureMobileOfflineDbReady();

  if (!connection) {
    return null;
  }

  return connection;
}
