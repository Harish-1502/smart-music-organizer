import { beforeEach, describe, expect, it, vi } from "vitest";

const apiBaseMocks = {
  fetchAuthenticatedBlob: vi.fn(),
  getTrackArtPath: vi.fn((trackId) => `/tracks/${trackId}/art`),
  getTrackStreamPath: vi.fn((trackId) => `/tracks/${trackId}/stream`),
};

const offlineStorageMocks = {
  getDownloadedTrack: vi.fn(),
  saveDownloadedPlaylist: vi.fn(),
};

const mobileOfflineRepositoryMocks = {
  getOfflineTrack: vi.fn(),
  saveNativeDownloadedPlaylist: vi.fn(),
  shouldUseMobileOfflineSqlite: vi.fn(),
};

const nativeMediaFileStorageMocks = {
  deleteAudioFile: vi.fn(),
  deleteArtworkFile: vi.fn(),
  saveAudioFile: vi.fn(),
  saveArtworkFile: vi.fn(),
};

vi.mock("../api/apiBase", () => apiBaseMocks);
vi.mock("./offlineStorage", () => offlineStorageMocks);
vi.mock("./mobileOfflineRepository", () => mobileOfflineRepositoryMocks);
vi.mock("./nativeMediaFileStorage", () => nativeMediaFileStorageMocks);

async function loadModule() {
  return import("./downloadPlaylist.js");
}

function createAbortError() {
  const error = new Error("Offline download cancelled.");
  error.name = "AbortError";
  return error;
}

describe("downloadPlaylistForOffline", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    offlineStorageMocks.getDownloadedTrack.mockResolvedValue(null);
    offlineStorageMocks.saveDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      name: "Browser Playlist",
    });

    mobileOfflineRepositoryMocks.getOfflineTrack.mockResolvedValue(null);
    mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      name: "Native Playlist",
    });
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(false);

    nativeMediaFileStorageMocks.deleteAudioFile.mockResolvedValue(true);
    nativeMediaFileStorageMocks.deleteArtworkFile.mockResolvedValue(true);
    nativeMediaFileStorageMocks.saveAudioFile.mockResolvedValue({
      relativePath: "media/audio/track-1.mp3",
    });
    nativeMediaFileStorageMocks.saveArtworkFile.mockResolvedValue({
      relativePath: "media/artwork/track-1.jpg",
    });
  });

  it("keeps the existing IndexedDB browser path intact", async () => {
    const audioBlob = new Blob(["audio"], { type: "audio/mpeg" });
    const artworkBlob = new Blob(["art"], { type: "image/jpeg" });
    apiBaseMocks.fetchAuthenticatedBlob
      .mockResolvedValueOnce(audioBlob)
      .mockResolvedValueOnce(artworkBlob);

    const { downloadPlaylistForOffline } = await loadModule();
    const result = await downloadPlaylistForOffline({
      playlist: {
        id: "playlist-1",
        name: "Browser Playlist",
        tracks: [{ id: "track-1", title: "Song A", artist: "Artist A" }],
      },
    });

    expect(result.savedPlaylist).toEqual({
      id: "playlist-1",
      name: "Browser Playlist",
    });
    expect(offlineStorageMocks.saveDownloadedPlaylist).toHaveBeenCalledTimes(1);
    expect(mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist).not.toHaveBeenCalled();
    expect(nativeMediaFileStorageMocks.saveAudioFile).not.toHaveBeenCalled();
    expect(apiBaseMocks.fetchAuthenticatedBlob).toHaveBeenCalledWith(
      "/tracks/track-1/stream",
      { signal: undefined },
    );
    expect(apiBaseMocks.fetchAuthenticatedBlob).toHaveBeenCalledWith(
      "/tracks/track-1/art",
      { signal: undefined },
    );
    for (const [path] of apiBaseMocks.fetchAuthenticatedBlob.mock.calls) {
      expect(path).not.toContain("api_token=");
    }
  });

  it("uses native file storage and SQLite metadata on Android", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    const audioBlob = new Blob(["audio"], { type: "audio/mpeg" });
    const artworkBlob = new Blob(["art"], { type: "image/jpeg" });
    apiBaseMocks.fetchAuthenticatedBlob
      .mockResolvedValueOnce(audioBlob)
      .mockResolvedValueOnce(artworkBlob);

    const { downloadPlaylistForOffline } = await loadModule();
    const result = await downloadPlaylistForOffline({
      playlist: {
        id: "playlist-1",
        name: "Native Playlist",
        tracks: [
          {
            id: "track-1",
            title: "Song A",
            artist: "Artist A",
            album: "Album A",
            duration: 245,
            file_path: "S:\\Music\\song-a.mp3",
            folder_path: "S:\\Music",
            art_path: "S:\\Music\\cover.jpg",
          },
        ],
      },
    });

    expect(result.savedPlaylist).toEqual({
      id: "playlist-1",
      name: "Native Playlist",
    });
    expect(nativeMediaFileStorageMocks.saveAudioFile).toHaveBeenCalledWith(
      "track-1",
      audioBlob,
      "audio/mpeg",
    );
    expect(nativeMediaFileStorageMocks.saveArtworkFile).toHaveBeenCalledWith(
      "track-1",
      artworkBlob,
      "image/jpeg",
    );
    expect(mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist).toHaveBeenCalledTimes(1);

    const nativePayload = mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist.mock.calls[0][0];
    expect(nativePayload.tracks).toEqual([
      expect.objectContaining({
        id: "track-1",
        title: "Song A",
        artist: "Artist A",
        album: "Album A",
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: "media/artwork/track-1.jpg",
        storageType: "native_file",
      }),
    ]);
    expect(nativePayload.tracks[0]).not.toHaveProperty("file_path");
    expect(nativePayload.tracks[0]).not.toHaveProperty("folder_path");
    expect(nativePayload.tracks[0]).not.toHaveProperty("art_path");
    for (const [path] of apiBaseMocks.fetchAuthenticatedBlob.mock.calls) {
      expect(path).not.toContain("api_token=");
    }
  });

  it("does not fail the whole native track when artwork download fails", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    const audioBlob = new Blob(["audio"], { type: "audio/mpeg" });
    apiBaseMocks.fetchAuthenticatedBlob
      .mockResolvedValueOnce(audioBlob)
      .mockRejectedValueOnce(new Error("Artwork unavailable"));

    const { downloadPlaylistForOffline } = await loadModule();
    const result = await downloadPlaylistForOffline({
      playlist: {
        id: "playlist-1",
        name: "Native Playlist",
        tracks: [{ id: "track-1", title: "Song A" }],
      },
    });

    expect(result.completedTracks).toBe(1);
    expect(result.failedTracks).toBe(0);
    expect(nativeMediaFileStorageMocks.saveArtworkFile).not.toHaveBeenCalled();
    expect(mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: "track-1",
            audioLocalUri: "media/audio/track-1.mp3",
            artworkLocalUri: null,
          }),
        ],
      }),
    );
  });

  it("avoids committing playlist metadata when download is cancelled", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    const audioBlob = new Blob(["audio"], { type: "audio/mpeg" });
    apiBaseMocks.fetchAuthenticatedBlob
      .mockResolvedValueOnce(audioBlob)
      .mockRejectedValueOnce(createAbortError());

    const { downloadPlaylistForOffline } = await loadModule();

    await expect(
      downloadPlaylistForOffline({
        playlist: {
          id: "playlist-1",
          name: "Native Playlist",
          tracks: [{ id: "track-1", title: "Song A" }],
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist).not.toHaveBeenCalled();
    expect(nativeMediaFileStorageMocks.deleteAudioFile).toHaveBeenCalledWith("track-1");
  });

  it("cleans up newly created native files when SQLite metadata save fails", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    const audioBlob = new Blob(["audio"], { type: "audio/mpeg" });
    const artworkBlob = new Blob(["art"], { type: "image/jpeg" });
    apiBaseMocks.fetchAuthenticatedBlob
      .mockResolvedValueOnce(audioBlob)
      .mockResolvedValueOnce(artworkBlob);
    mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist.mockResolvedValue(null);

    const { downloadPlaylistForOffline } = await loadModule();

    await expect(
      downloadPlaylistForOffline({
        playlist: {
          id: "playlist-1",
          name: "Native Playlist",
          tracks: [{ id: "track-1", title: "Song A" }],
        },
      }),
    ).rejects.toThrow("Could not save native offline playlist metadata.");

    expect(nativeMediaFileStorageMocks.deleteAudioFile).toHaveBeenCalledWith("track-1");
    expect(nativeMediaFileStorageMocks.deleteArtworkFile).toHaveBeenCalledWith("track-1");
  });
});
