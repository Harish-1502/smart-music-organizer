import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  return import("./appMode.js");
}

function createLocalStorageMock() {
  const store = new Map();

  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
  };
}

describe("appMode", () => {
  let windowMock;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    windowMock = new EventTarget();
    windowMock.localStorage = createLocalStorageMock();
    global.window = windowMock;
  });

  it("defaults to LAN mode", async () => {
    const { getAppMode, isLanMode, isOfflineMode } = await loadModule();

    expect(getAppMode()).toBe("lan");
    expect(isLanMode()).toBe(true);
    expect(isOfflineMode()).toBe(false);
  });

  it("stores and reads offline mode", async () => {
    const { getAppMode, setAppMode, isOfflineMode } = await loadModule();

    expect(setAppMode("offline")).toBe("offline");
    expect(getAppMode()).toBe("offline");
    expect(isOfflineMode()).toBe(true);
  });

  it("respects the saved mode after a remount-style module reload", async () => {
    let module = await loadModule();
    module.setAppMode("offline");

    vi.resetModules();
    module = await loadModule();

    expect(module.getAppMode()).toBe("offline");
    expect(module.isOfflineMode()).toBe(true);
  });

  it("clears back to LAN mode", async () => {
    const { clearAppMode, getAppMode, setAppMode } = await loadModule();

    setAppMode("offline");
    clearAppMode();

    expect(getAppMode()).toBe("lan");
  });

  it("rejects invalid modes", async () => {
    const { normalizeAppMode, setAppMode } = await loadModule();

    expect(() => normalizeAppMode("remote")).toThrow(
      'App mode must be either "lan" or "offline".',
    );
    expect(() => setAppMode("desktop")).toThrow(
      'App mode must be either "lan" or "offline".',
    );
  });

  it("falls back safely to LAN when an invalid mode is already stored", async () => {
    windowMock.localStorage.setItem("smart-music-organizer:app-mode", "desktop");
    const { getAppMode, isLanMode } = await loadModule();

    expect(getAppMode()).toBe("lan");
    expect(isLanMode()).toBe(true);
    expect(windowMock.localStorage.removeItem).toHaveBeenCalledWith(
      "smart-music-organizer:app-mode",
    );
  });

  it("notifies subscribers when the mode changes", async () => {
    const { setAppMode, subscribeToAppModeChanges } = await loadModule();
    const listener = vi.fn();
    const unsubscribe = subscribeToAppModeChanges(listener);

    setAppMode("offline");
    setAppMode("lan");

    expect(listener).toHaveBeenCalledWith("offline");
    expect(listener).toHaveBeenCalledWith("lan");

    unsubscribe();
  });
});
