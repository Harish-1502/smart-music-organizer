import {
    getMobileOfflineDb,
    isNativeAndroidMobileOfflineSupported,
    ensureMobileOfflineDbReady as ensureNativeMobileOfflineDbReady
} from "../mobileSqliteDb";

import {
  OfflineDatabaseUnavailableError,
  createOfflineMetadataSaveError,
} from "./offlineErrors";

// platform check
export function shouldUseMobileOfflineSqlite() {
  return isNativeAndroidMobileOfflineSupported();
}

// Checks to see if the offline database is ready to be used
export async function ensureMobileOfflineDbReady() {
  if (!shouldUseMobileOfflineSqlite()) {
    return false;
  }

  const database = await ensureNativeMobileOfflineDbReady();

  if (!database) {
    throw new OfflineDatabaseUnavailableError();
  }

  return database;
}

// query execution helper
export async function queryRows(statement, values = [], options = {}) {
  const database = options?.rethrow
    ? await ensureMobileOfflineDbReady()
    : await getMobileOfflineDb();

  if (!database) {
    if (options?.rethrow) {
      throw new OfflineDatabaseUnavailableError();
    }

    return [];
  }

  try {
    const result = await database.query(statement, values);
    return Array.isArray(result?.values) ? result.values : [];
  } catch (error) {
    if (options?.rethrow) {
      throw error;
    }

    return [];
  }
}

// Transaction execution helper
export async function withMobileOfflineTransaction(work, options = {}) {
  const database = options?.rethrow
    ? await ensureMobileOfflineDbReady()
    : await getMobileOfflineDb();

  if (!database) {
    if (options?.rethrow) {
      throw new OfflineDatabaseUnavailableError();
    }

    return null;
  }

  let transactionStarted = false;

  try {
    await database.beginTransaction();
    transactionStarted = true;
    const result = await work(database);
    await database.commitTransaction();
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await database.rollbackTransaction();
      } catch {}
    }

    if (options?.rethrow) {
      throw error;
    }

    return null;
  }
}

export function normalizeSqliteValue(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

export function assertValidSqliteValues(values, track, label) {
  values.forEach((value, index) => {
    if (value === undefined) {
      throw createOfflineMetadataSaveError(
        track,
        `SQLite value ${label}[${index}] was undefined.`,
      );
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      throw createOfflineMetadataSaveError(
        track,
        `SQLite value ${label}[${index}] was not finite.`,
      );
    }
  });
}