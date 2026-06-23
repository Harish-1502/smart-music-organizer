import { beforeEach, describe, expect, it, vi } from "vitest";

const appModeMocks = {
  isOfflineMode: vi.fn((mode) => mode === "offline"),
};

vi.mock("../appMode/appMode", () => appModeMocks);

async function loadModule() {
  return import("./playlistSource.js");
}

describe("playlistSource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the backend source in LAN mode", async () => {
    const { getPlaylistSourceForMode } = await loadModule();
    const source = getPlaylistSourceForMode("lan");

    expect(source.kind).toBe("backend");
  });

  it("returns the offline source in Offline Mode", async () => {
    const { getPlaylistSourceForMode } = await loadModule();
    const source = getPlaylistSourceForMode("offline");

    expect(source.kind).toBe("offline");
  });
});

