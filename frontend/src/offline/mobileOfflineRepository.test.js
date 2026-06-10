import { beforeEach, describe, expect, it, vi } from "vitest";

let nativeAndroidSupported = false;
let mobileDatabase = null;

const offlineStorageMocks = {
  clearOfflineDownloads: vi.fn(),
  deleteDownloadedPlaylist: vi.fn(),
  getDownloadedPlaylist: vi.fn(),
  getDownloadedPlaylists: vi.fn(),
  getDownloadedTrack: vi.fn(),
  getDownloadedTracks: vi.fn(),
};

vi.mock("./offlineStorage", () => offlineStorageMocks);

vi.mock("./mobileSqliteDb", () => ({
  getMobileOfflineDb: vi.fn(async () => mobileDatabase),
  initializeMobileOfflineDb: vi.fn(async () => Boolean(mobileDatabase)),
  isNativeAndroidMobileOfflineSupported: vi.fn(() => nativeAndroidSupported),
}));

async function loadRepository() {
  return import("./mobileOfflineRepository.js");
}

function createMockDatabase({ queryHandler } = {}) {
  return {
    beginTransaction: vi.fn().mockResolvedValue({}),
    commitTransaction: vi.fn().mockResolvedValue({}),
    rollbackTransaction: vi.fn().mockResolvedValue({}),
    run: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
    query: vi.fn(async (statement, values = []) => {
      if (queryHandler) {
        return queryHandler(statement, values);
      }

      return { values: [] };
    }),
  };
}

describe("mobileOfflineRepository", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nativeAndroidSupported = false;
    mobileDatabase = null;

    offlineStorageMocks.clearOfflineDownloads.mockResolvedValue(true);
    offlineStorageMocks.deleteDownloadedPlaylist.mockResolvedValue(true);
    offlineStorageMocks.getDownloadedPlaylist.mockResolvedValue(null);
    offlineStorageMocks.getDownloadedPlaylists.mockResolvedValue([]);
    offlineStorageMocks.getDownloadedTrack.mockResolvedValue(null);
    offlineStorageMocks.getDownloadedTracks.mockResolvedValue([]);
  });

  it("uses the SQLite path for playlist reads on native Android", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async () => ({
        values: [{ id: "p1", name: "Road Trip", totalTracks: 3 }],
      }),
    });

    const { getOfflinePlaylists } = await loadRepository();
    const playlists = await getOfflinePlaylists();

    expect(playlists).toEqual([{ id: "p1", name: "Road Trip", totalTracks: 3 }]);
    expect(mobileDatabase.query).toHaveBeenCalledTimes(1);
    expect(offlineStorageMocks.getDownloadedPlaylists).not.toHaveBeenCalled();
  });

  it("uses the IndexedDB fallback path in the browser", async () => {
    offlineStorageMocks.getDownloadedPlaylists.mockResolvedValue([
      { id: "browser-playlist", name: "Browser Fallback" },
    ]);

    const { getOfflinePlaylists } = await loadRepository();
    const playlists = await getOfflinePlaylists();

    expect(playlists).toEqual([
      { id: "browser-playlist", name: "Browser Fallback" },
    ]);
    expect(offlineStorageMocks.getDownloadedPlaylists).toHaveBeenCalledTimes(1);
  });

  it("builds playlist tracks from the IndexedDB fallback path in the browser", async () => {
    offlineStorageMocks.getDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      trackIds: ["track-2", "track-1"],
    });
    offlineStorageMocks.getDownloadedTracks.mockResolvedValue([
      { id: "track-1", title: "One" },
      { id: "track-2", title: "Two" },
    ]);

    const { getOfflineTracksForPlaylist } = await loadRepository();
    const tracks = await getOfflineTracksForPlaylist("playlist-1");

    expect(tracks).toEqual([
      expect.objectContaining({
        id: "track-2",
        title: "Two",
        trackOrder: 0,
        storageType: "indexeddb_blob",
      }),
      expect.objectContaining({
        id: "track-1",
        title: "One",
        trackOrder: 1,
        storageType: "indexeddb_blob",
      }),
    ]);
    expect(offlineStorageMocks.getDownloadedPlaylist).toHaveBeenCalledWith("playlist-1");
    expect(offlineStorageMocks.getDownloadedTracks).toHaveBeenCalledTimes(1);
  });

  it("rejects Windows drive paths for media refs", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { saveOfflineMediaFileRef } = await loadRepository();

    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "C:\\Music\\song.mp3"),
    ).resolves.toBeNull();
    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "S:\\Music\\song.mp3"),
    ).resolves.toBeNull();

    expect(mobileDatabase.beginTransaction).not.toHaveBeenCalled();
  });

  it("rejects UNC and traversal paths for media refs", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { saveOfflineMediaFileRef } = await loadRepository();

    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "\\\\DESKTOP\\Music\\song.mp3"),
    ).resolves.toBeNull();
    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "../media/audio/123.mp3"),
    ).resolves.toBeNull();
    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "media/../audio/123.mp3"),
    ).resolves.toBeNull();

    expect(mobileDatabase.beginTransaction).not.toHaveBeenCalled();
  });

  it("accepts safe app-local media refs", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT * FROM offline_media_files")) {
          return {
            values: [
              {
                track_id: values[0],
                media_type: values[1],
                local_uri: "media/audio/123.mp3",
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { saveOfflineMediaFileRef } = await loadRepository();
    const result = await saveOfflineMediaFileRef(
      "track-1",
      "audio",
      "media/audio/123.mp3",
    );

    expect(result).toEqual(
      expect.objectContaining({
        track_id: "track-1",
        media_type: "audio",
        local_uri: "media/audio/123.mp3",
      }),
    );
    expect(mobileDatabase.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mobileDatabase.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it("writes offline track metadata to SQLite", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT * FROM offline_tracks")) {
          return {
            values: [
              {
                id: values[0],
                title: "Song A",
                download_status: "downloaded",
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { saveOfflineTrackMetadata } = await loadRepository();
    const track = await saveOfflineTrackMetadata({
      id: "track-1",
      title: "Song A",
      artist: "Artist A",
      album: "Album A",
      duration: 245,
      downloadStatus: "downloaded",
    });

    expect(track).toEqual(
      expect.objectContaining({
        id: "track-1",
        title: "Song A",
        download_status: "downloaded",
      }),
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO offline_tracks"),
      expect.arrayContaining(["track-1", "Song A", "Artist A", "Album A", 245]),
      false,
    );
  });

  it("writes offline playlist metadata to SQLite", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT * FROM offline_playlists")) {
          return {
            values: [
              {
                id: values[0],
                name: "Favorites",
                total_tracks: 12,
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { saveOfflinePlaylistMetadata } = await loadRepository();
    const playlist = await saveOfflinePlaylistMetadata({
      id: "playlist-1",
      name: "Favorites",
      totalTracks: 12,
      totalBytes: 1024,
      downloadStatus: "downloaded",
    });

    expect(playlist).toEqual(
      expect.objectContaining({
        id: "playlist-1",
        name: "Favorites",
      }),
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO offline_playlists"),
      expect.arrayContaining(["playlist-1", "Favorites", 12, 1024, "downloaded"]),
      false,
    );
  });

  it("saves playlist track order to SQLite", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { saveOfflinePlaylistTracks } = await loadRepository();
    const result = await saveOfflinePlaylistTracks("playlist-1", [
      "track-3",
      "track-1",
      "track-2",
    ]);

    expect(result).toBe(true);
    expect(mobileDatabase.run).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
      ["playlist-1"],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO offline_playlist_tracks"),
      ["playlist-1", "track-3", 0, expect.any(String)],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO offline_playlist_tracks"),
      ["playlist-1", "track-2", 2, expect.any(String)],
      false,
    );
  });

  it("deletes only the removed playlist membership and preserves shared tracks", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT track_id AS trackId FROM offline_playlist_tracks")) {
          return { values: [{ trackId: "track-shared" }, { trackId: "track-exclusive" }] };
        }

        if (statement.includes("SELECT COUNT(*) AS count FROM offline_playlist_tracks")) {
          if (values[0] === "track-shared") {
            return { values: [{ count: 1 }] };
          }

          if (values[0] === "track-exclusive") {
            return { values: [{ count: 0 }] };
          }
        }

        return { values: [] };
      },
    });

    const { deleteOfflinePlaylist } = await loadRepository();
    const result = await deleteOfflinePlaylist("playlist-1");

    expect(result).toBe(true);
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_playlists WHERE id = ?",
      ["playlist-1"],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_media_files WHERE track_id = ?",
      ["track-exclusive"],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_tracks WHERE id = ?",
      ["track-exclusive"],
      false,
    );
    expect(mobileDatabase.run).not.toHaveBeenCalledWith(
      "DELETE FROM offline_tracks WHERE id = ?",
      ["track-shared"],
      false,
    );
  });

  it("clears all mobile offline tables on native Android", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { clearMobileOfflineData } = await loadRepository();
    const result = await clearMobileOfflineData();

    expect(result).toBe(true);
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_media_files",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_playlist_tracks",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_downloads",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_tracks",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_playlists",
      [],
      false,
    );
  });

  it("uses IndexedDB fallbacks for delete and clear in the browser", async () => {
    const { deleteOfflinePlaylist, clearMobileOfflineData } = await loadRepository();

    await expect(deleteOfflinePlaylist("playlist-1")).resolves.toBe(true);
    await expect(clearMobileOfflineData()).resolves.toBe(true);

    expect(offlineStorageMocks.deleteDownloadedPlaylist).toHaveBeenCalledWith(
      "playlist-1",
    );
    expect(offlineStorageMocks.clearOfflineDownloads).toHaveBeenCalledTimes(1);
  });
});
