import { beforeEach, describe, expect, it, vi } from "vitest";

let demoModeEnabled = false;

const offlineStorageMocks = {
  saveDownloadedPlaylist: vi.fn(),
};

const mobileOfflineRepositoryMocks = {
  saveNativeDownloadedPlaylist: vi.fn(),
  shouldUseMobileOfflineSqlite: vi.fn(),
};

const offlineTrackDownloadMocks = {
  cleanupCreatedNativeFiles: vi.fn(),
  createAbortError: vi.fn(() => {
    const error = new Error("Offline download cancelled.");
    error.name = "AbortError";
    return error;
  }),
  downloadTrackForOffline: vi.fn(),
};

vi.mock("../../storage/offlineStorage", () => offlineStorageMocks);
vi.mock("../../storage/mobileOfflineRepository", () => mobileOfflineRepositoryMocks);
vi.mock("../../services/offlineTrackDownload", () => offlineTrackDownloadMocks);
vi.mock("../../../../utils/demoMode", () => ({
  isDemoMode: () => demoModeEnabled,
  maskPlaylist: (playlist, index = 0) =>
    demoModeEnabled && playlist
      ? {
          ...playlist,
          name: `Demo Playlist ${String(index + 1).padStart(3, "0")}`,
        }
      : playlist,
  maskTrack: (track, index = 0) =>
    demoModeEnabled && track
      ? {
          ...track,
          title: `Demo Track ${String(index + 1).padStart(3, "0")}`,
        }
      : track,
}));

async function loadModule() {
  return import("../../services/downloadPlaylist.js");
}

describe("downloadPlaylistForOffline", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    demoModeEnabled = false;

    offlineStorageMocks.saveDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      name: "Browser Playlist",
    });
    mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      name: "Native Playlist",
    });
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(false);
  });

  it("keeps the existing IndexedDB browser path intact", async () => {
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValue({
      status: "downloaded",
      trackId: "track-1",
      title: "Song A",
      downloadedBytes: 128,
      downloadedTrack: {
        id: "track-1",
        title: "Song A",
        artist: "Artist A",
        audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
        artworkBlob: new Blob(["art"], { type: "image/jpeg" }),
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    });

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
  });

  it("masks playlist track titles in demo mode before saving offline downloads", async () => {
    demoModeEnabled = true;
    offlineStorageMocks.saveDownloadedPlaylist.mockResolvedValueOnce({
      id: "playlist-1",
      name: "Demo Playlist 001",
    });
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValue({
      status: "downloaded",
      trackId: "track-1",
      title: "Demo Track 001",
      downloadedBytes: 128,
      downloadedTrack: {
        id: "track-1",
        title: "Demo Track 001",
        artist: "Artist A",
        audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
        artworkBlob: new Blob(["art"], { type: "image/jpeg" }),
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    });

    const { downloadPlaylistForOffline } = await loadModule();
    const result = await downloadPlaylistForOffline({
      playlist: {
        id: "playlist-1",
        name: "Road Trip",
        tracks: [{ id: "track-1", title: "Actual Song", artist: "Artist A" }],
      },
    });

    expect(result.savedPlaylist).toEqual({
      id: "playlist-1",
      name: "Demo Playlist 001",
    });
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "track-1",
        title: "Demo Track 001",
      }),
      expect.any(Object),
    );
    expect(offlineStorageMocks.saveDownloadedPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Demo Playlist 001",
        tracks: [
          expect.objectContaining({
            id: "track-1",
            title: "Demo Track 001",
          }),
        ],
      }),
    );
  });

  it("uses native file storage and SQLite metadata on Android", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValue({
      status: "downloaded",
      trackId: "track-1",
      title: "Song A",
      downloadedBytes: 256,
      downloadedTrack: {
        id: "track-1",
        title: "Song A",
        artist: "Artist A",
        album: "Album A",
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: "media/artwork/track-1.jpg",
        storageType: "native_file",
      },
      createdNativeFiles: {
        audio: true,
        artwork: true,
      },
    });

    const { downloadPlaylistForOffline } = await loadModule();
    const result = await downloadPlaylistForOffline({
      playlist: {
        id: "playlist-1",
        name: "Native Playlist",
        tracks: [{ id: "track-1", title: "Song A", artist: "Artist A" }],
      },
    });

    expect(result.savedPlaylist).toEqual({
      id: "playlist-1",
      name: "Native Playlist",
    });
    expect(mobileOfflineRepositoryMocks.saveNativeDownloadedPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: "track-1",
            audioLocalUri: "media/audio/track-1.mp3",
            artworkLocalUri: "media/artwork/track-1.jpg",
            storageType: "native_file",
          }),
        ],
      }),
    );
  });

  it("does not fail the whole native track when artwork download fails upstream", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValue({
      status: "downloaded",
      trackId: "track-1",
      title: "Song A",
      downloadedBytes: 128,
      downloadedTrack: {
        id: "track-1",
        title: "Song A",
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: null,
        storageType: "native_file",
      },
      createdNativeFiles: {
        audio: true,
        artwork: false,
      },
    });

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
    offlineTrackDownloadMocks.downloadTrackForOffline.mockRejectedValueOnce(
      offlineTrackDownloadMocks.createAbortError(),
    );

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
  });

  it("cleans up newly created native files when SQLite metadata save fails", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValue({
      status: "downloaded",
      trackId: "track-1",
      title: "Song A",
      downloadedBytes: 128,
      downloadedTrack: {
        id: "track-1",
        title: "Song A",
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: "media/artwork/track-1.jpg",
        storageType: "native_file",
      },
      createdNativeFiles: {
        audio: true,
        artwork: true,
      },
    });
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

    expect(offlineTrackDownloadMocks.cleanupCreatedNativeFiles).toHaveBeenCalledWith(
      {
        audio: ["track-1"],
        artwork: ["track-1"],
      },
    );
  });
});
