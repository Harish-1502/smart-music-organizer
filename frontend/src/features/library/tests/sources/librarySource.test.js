import { beforeEach, describe, expect, it, vi } from "vitest";

const appModeMocks = {
  isOfflineMode: vi.fn((mode) => mode === "offline"),
};

vi.mock("../../../../appMode/appMode", () => appModeMocks);

async function loadModule() {
  return import("../../sources/librarySource.js");
}

describe("librarySource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the backend source in LAN mode", async () => {
    const { getLibrarySourceForMode } = await loadModule();
    const source = getLibrarySourceForMode("lan");

    expect(source.kind).toBe("backend");
  });

  it("returns the offline source in Offline Mode", async () => {
    const { getLibrarySourceForMode } = await loadModule();
    const source = getLibrarySourceForMode("offline");

    expect(source.kind).toBe("offline");
  });

  it("switches between sources when the mode changes", async () => {
    const { getLibrarySourceForMode } = await loadModule();
    const lanSource = getLibrarySourceForMode("lan");
    const offlineSource = getLibrarySourceForMode("offline");
    const restoredLanSource = getLibrarySourceForMode("lan");

    expect(lanSource.kind).toBe("backend");
    expect(offlineSource.kind).toBe("offline");
    expect(restoredLanSource).toBe(lanSource);
    expect(offlineSource).not.toBe(lanSource);
  });
});
