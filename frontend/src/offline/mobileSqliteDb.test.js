import { beforeEach, describe, expect, it, vi } from "vitest";

let isNativePlatform = false;
let currentPlatform = "web";

const mockConnection = {
  open: vi.fn(),
  execute: vi.fn(),
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
  });
});
