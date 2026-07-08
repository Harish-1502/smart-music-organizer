import { beforeEach, describe, expect, it, vi } from "vitest";

const playlistApiMocks = {
  createPlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  generateAiPlaylist: vi.fn(),
  getPlaylistDetail: vi.fn(),
  getPlaylists: vi.fn(),
  removeTrackFromPlaylist: vi.fn(),
  renamePlaylist: vi.fn(),
};

vi.mock("../../../api/playlistApi", () => playlistApiMocks);

async function loadModule() {
  return import("./backendPlaylistSource.js");
}

describe("backendPlaylistSource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("delegates list and detail reads to the backend playlist API", async () => {
    const { backendPlaylistSource } = await loadModule();

    await backendPlaylistSource.getPlaylists();
    await backendPlaylistSource.getPlaylistDetail("playlist-1");

    expect(playlistApiMocks.getPlaylists).toHaveBeenCalledTimes(1);
    expect(playlistApiMocks.getPlaylistDetail).toHaveBeenCalledWith("playlist-1");
  });

  it("delegates playlist mutations to the backend playlist API", async () => {
    const { backendPlaylistSource } = await loadModule();

    await backendPlaylistSource.createPlaylist("Road Trip");
    await backendPlaylistSource.renamePlaylist("playlist-1", "Late Night");
    await backendPlaylistSource.deletePlaylist("playlist-1");
    await backendPlaylistSource.removeTrackFromPlaylist(
      "playlist-1",
      "playlist-track-1",
    );
    await backendPlaylistSource.generateAiPlaylist("warm synthwave");

    expect(playlistApiMocks.createPlaylist).toHaveBeenCalledWith("Road Trip");
    expect(playlistApiMocks.renamePlaylist).toHaveBeenCalledWith(
      "playlist-1",
      "Late Night",
    );
    expect(playlistApiMocks.deletePlaylist).toHaveBeenCalledWith("playlist-1");
    expect(playlistApiMocks.removeTrackFromPlaylist).toHaveBeenCalledWith(
      "playlist-1",
      "playlist-track-1",
    );
    expect(playlistApiMocks.generateAiPlaylist).toHaveBeenCalledWith(
      "warm synthwave",
    );
  });
});
