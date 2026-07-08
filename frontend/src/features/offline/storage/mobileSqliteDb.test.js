import { beforeEach, describe, expect, it, vi } from "vitest";

let isNativePlatform = false;
let currentPlatform = "web";

const mockConnection = {
  open: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
};

const mockSqliteManager = {
  checkConnectionsConsistency: vi.fn(),
  isConnection: vi.fn(),
  retrieveConnection: vi.fn(),
  createConnection: vi.fn(),
};

const SQLiteConnectionMock = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform,
    getPlatform: () => currentPlatform,
  },
}));

vi.mock("@capacitor-community/sqlite", () => ({
  CapacitorSQLite: { plugin: "sqlite" },
  SQLiteConnection: SQLiteConnectionMock,
}));

async function loadModule() {
  return import("./mobileSqliteDb.js");
}

describe("mobileSqliteDb", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    isNativePlatform = false;
    currentPlatform = "web";

    mockConnection.open.mockResolvedValue(undefined);
    mockConnection.execute.mockResolvedValue({ changes: { changes: 0 } });
    mockConnection.query.mockResolvedValue({ values: [{ ready: 1 }] });

    mockSqliteManager.checkConnectionsConsistency.mockResolvedValue({ result: true });
    mockSqliteManager.isConnection.mockResolvedValue({ result: false });
    mockSqliteManager.retrieveConnection.mockResolvedValue(mockConnection);
    mockSqliteManager.createConnection.mockResolvedValue(mockConnection);

    SQLiteConnectionMock.mockImplementation(function mockSQLiteConnection() {
      return mockSqliteManager;
    });
  });

  it("returns true for native Android", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const { isNativeAndroidMobileOfflineSupported } = await loadModule();

    expect(isNativeAndroidMobileOfflineSupported()).toBe(true);
  });

  it("returns false in the browser", async () => {
    const { isNativeAndroidMobileOfflineSupported } = await loadModule();

    expect(isNativeAndroidMobileOfflineSupported()).toBe(false);
  });

  it("returns false for non-Android native platforms", async () => {
    isNativePlatform = true;
    currentPlatform = "ios";

    const { isNativeAndroidMobileOfflineSupported } = await loadModule();

    expect(isNativeAndroidMobileOfflineSupported()).toBe(false);
  });

  it("creates and initializes the SQLite schema on native Android", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const {
      initializeMobileOfflineDb,
      MOBILE_OFFLINE_DB_NAME,
      MOBILE_OFFLINE_DB_VERSION,
    } = await loadModule();

    await expect(initializeMobileOfflineDb()).resolves.toBe(true);

    expect(SQLiteConnectionMock).toHaveBeenCalledTimes(1);
    expect(mockSqliteManager.checkConnectionsConsistency).toHaveBeenCalledTimes(1);
    expect(mockSqliteManager.isConnection).toHaveBeenCalledWith(
      MOBILE_OFFLINE_DB_NAME,
      false,
    );
    expect(mockSqliteManager.createConnection).toHaveBeenCalledWith(
      MOBILE_OFFLINE_DB_NAME,
      false,
      "no-encryption",
      MOBILE_OFFLINE_DB_VERSION,
      false,
    );
    expect(mockConnection.open).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS offline_tracks"),
      true,
    );
    expect(mockConnection.query).toHaveBeenCalledWith("SELECT 1 AS ready");
  });

  it("does not treat empty checkConnectionsConsistency results as a failure before create/open", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    mockSqliteManager.checkConnectionsConsistency.mockResolvedValue({
      dbNames: [],
      openModes: [],
    });

    const { ensureMobileOfflineDbReady } = await loadModule();

    await expect(ensureMobileOfflineDbReady()).resolves.toBe(mockConnection);

    expect(mockSqliteManager.createConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.open).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.query).toHaveBeenCalledWith("SELECT 1 AS ready");
  });

  it("retries SQLite initialization after an initial unavailable connection", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    mockSqliteManager.createConnection
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockConnection);

    const { ensureMobileOfflineDbReady } = await loadModule();

    await expect(ensureMobileOfflineDbReady()).resolves.toBe(mockConnection);

    expect(mockSqliteManager.createConnection).toHaveBeenCalledTimes(2);
    expect(mockConnection.open).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.query).toHaveBeenCalledWith("SELECT 1 AS ready");
  });

  it("shares one initialization promise across concurrent callers", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    let resolveExecute;
    const executePromise = new Promise((resolve) => {
      resolveExecute = resolve;
    });
    mockConnection.execute.mockImplementation(() => executePromise);

    const { initializeMobileOfflineDb } = await loadModule();

    const firstInit = initializeMobileOfflineDb();
    const secondInit = initializeMobileOfflineDb();

    resolveExecute({ changes: { changes: 0 } });

    await expect(Promise.all([firstInit, secondInit])).resolves.toEqual([
      true,
      true,
    ]);

    expect(mockSqliteManager.createConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.open).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.query).toHaveBeenCalledTimes(1);
  });

  it("resets the init promise after failure so a retry can reopen and verify the database", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    mockConnection.execute
      .mockRejectedValueOnce(new Error("schema failed"))
      .mockResolvedValueOnce({ changes: { changes: 0 } });

    const { initializeMobileOfflineDb } = await loadModule();

    await expect(initializeMobileOfflineDb()).resolves.toBe(false);
    await expect(initializeMobileOfflineDb()).resolves.toBe(true);

    expect(mockSqliteManager.createConnection).toHaveBeenCalledTimes(2);
    expect(mockConnection.open).toHaveBeenCalledTimes(2);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    expect(mockConnection.query).toHaveBeenCalledWith("SELECT 1 AS ready");
  });

  it("short-circuits repeated readiness checks during the recent failure cooldown", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    mockSqliteManager.createConnection.mockRejectedValue(
      new Error("CapacitorSQLitePlugin: null"),
    );

    const { ensureMobileOfflineDbReady } = await loadModule();

    await expect(ensureMobileOfflineDbReady()).resolves.toBeNull();
    await expect(ensureMobileOfflineDbReady()).resolves.toBeNull();

    expect(mockSqliteManager.createConnection).toHaveBeenCalledTimes(2);
  });

  it("reports a structured diagnostic snapshot for successful native SQLite health checks", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const { probeMobileOfflineDbHealth } = await loadModule();
    const result = await probeMobileOfflineDbHealth({ forceRetry: true });

    expect(result).toEqual(
      expect.objectContaining({
        supported: true,
        platform: "android",
        importLoaded: true,
        hasCapacitorSQLite: true,
        hasSQLiteConnection: true,
        managerReady: true,
        connectionReady: true,
        schemaReady: true,
        verified: true,
      }),
    );
    expect(result.lastInitFailure).toBeNull();
  });
});
