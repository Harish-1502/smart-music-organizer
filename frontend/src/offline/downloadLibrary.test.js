import { beforeEach, describe, expect, it, vi } from "vitest";

const appModeMocks = {
  getAppMode: vi.fn(() => "lan"),
  isLanMode: vi.fn((mode) => mode === "lan"),
};

const backendLibrarySourceMocks = {
  backendLibrarySource: {
    getAllTracks: vi.fn(),
  },
};

const mobileOfflineRepositoryMocks = {
  hasVerifiedOfflineTrack: vi.fn(),
  saveOfflineMediaFileRef: vi.fn(),
  saveOfflineTrackMetadata: vi.fn(),
  shouldUseMobileOfflineSqlite: vi.fn(),
};

const offlineStorageMocks = {
  saveOfflineTrack: vi.fn(),
};

const offlineTrackDownloadMocks = {
  cleanupCreatedNativeFiles: vi.fn(),
  downloadTrackForOffline: vi.fn(),
};

vi.mock("../appMode/appMode", () => appModeMocks);
vi.mock("../library/backendLibrarySource", () => backendLibrarySourceMocks);
vi.mock("./mobileOfflineRepository", () => mobileOfflineRepositoryMocks);
vi.mock("./offlineStorage", () => offlineStorageMocks);
vi.mock("./offlineTrackDownload", () => offlineTrackDownloadMocks);

async function loadModule() {
  return import("./downloadLibrary.js");
}

describe("downloadLibrary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    appModeMocks.getAppMode.mockReturnValue("lan");
    appModeMocks.isLanMode.mockImplementation((mode) => mode === "lan");
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [],
      total_items: 0,
      total_pages: 1,
    });
    mobileOfflineRepositoryMocks.hasVerifiedOfflineTrack.mockResolvedValue(false);
    mobileOfflineRepositoryMocks.saveOfflineTrackMetadata.mockResolvedValue({
      id: "track-1",
    });
    mobileOfflineRepositoryMocks.saveOfflineMediaFileRef.mockResolvedValue({
      trackId: "track-1",
      mediaType: "audio",
      localUri: "media/audio/track-1.mp3",
    });
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(false);
    offlineStorageMocks.saveOfflineTrack.mockResolvedValue({
      id: "track-1",
      audioBlobId: "track:track-1:audio",
    });
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValue({
      status: "downloaded",
      trackId: "track-1",
      title: "Song A",
      downloadedBytes: 1024,
      downloadedTrack: {
        id: "track-1",
        title: "Song A",
        artist: "Artist A",
        audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
        artworkBlob: null,
        downloadedAt: "2026-06-15T12:00:00.000Z",
        sizeBytes: 1024,
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    });
  });

  it("fetches backend tracks only in LAN mode and skips already verified downloads", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [
        { id: "track-1", title: "Existing" },
        { id: "track-2", title: "Missing" },
      ],
      total_items: 2,
      total_pages: 1,
    });
    mobileOfflineRepositoryMocks.hasVerifiedOfflineTrack
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValueOnce({
      status: "downloaded",
      trackId: "track-2",
      title: "Missing",
      downloadedBytes: 2048,
      downloadedTrack: {
        id: "track-2",
        title: "Missing",
        artist: "Artist B",
        audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
        downloadedAt: "2026-06-15T12:00:00.000Z",
        sizeBytes: 2048,
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(backendLibrarySourceMocks.backendLibrarySource.getAllTracks).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        blocked: false,
        cancelled: false,
        totalLibraryTracks: 2,
        totalMissingTracks: 1,
        downloadedCount: 1,
        skippedCount: 1,
        failedCount: 0,
      }),
    );
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).toHaveBeenCalledTimes(1);
  });

  it("re-downloads tracks when metadata exists but verified audio does not", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [{ id: "track-1", title: "Needs Redownload" }],
      total_items: 1,
      total_pages: 1,
    });
    mobileOfflineRepositoryMocks.hasVerifiedOfflineTrack.mockResolvedValue(false);

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.downloadedCount).toBe(1);
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).toHaveBeenCalledWith(
      { id: "track-1", title: "Needs Redownload" },
      expect.objectContaining({
        abortDuringTrack: false,
      }),
    );
  });

  it("marks audio failures as failed and continues downloading later tracks", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [
        { id: "track-1", title: "Fails" },
        { id: "track-2", title: "Works" },
      ],
      total_items: 2,
      total_pages: 1,
    });
    offlineTrackDownloadMocks.downloadTrackForOffline
      .mockResolvedValueOnce({
        status: "failed",
        trackId: "track-1",
        title: "Fails",
        downloadedBytes: 0,
      })
      .mockResolvedValueOnce({
        status: "downloaded",
        trackId: "track-2",
        title: "Works",
        downloadedBytes: 1024,
        downloadedTrack: {
          id: "track-2",
          title: "Works",
          artist: "Artist B",
          audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
          downloadedAt: "2026-06-15T12:00:00.000Z",
          sizeBytes: 1024,
        },
        createdNativeFiles: {
          audio: false,
          artwork: false,
        },
      });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.failedCount).toBe(1);
    expect(result.downloadedCount).toBe(1);
    expect(offlineStorageMocks.saveOfflineTrack).toHaveBeenCalledTimes(1);
  });

  it("does not fail a track when artwork is unavailable but audio succeeded", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [{ id: "track-1", title: "Audio Only" }],
      total_items: 1,
      total_pages: 1,
    });
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValueOnce({
      status: "downloaded",
      trackId: "track-1",
      title: "Audio Only",
      downloadedBytes: 1024,
      downloadedTrack: {
        id: "track-1",
        title: "Audio Only",
        artist: "Artist A",
        audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
        artworkBlob: null,
        downloadedAt: "2026-06-15T12:00:00.000Z",
        sizeBytes: 1024,
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.failedCount).toBe(0);
    expect(result.downloadedCount).toBe(1);
  });

  it("stops after the current track when cancelled and keeps completed downloads", async () => {
    const controller = new AbortController();
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [
        { id: "track-1", title: "First" },
        { id: "track-2", title: "Second" },
      ],
      total_items: 2,
      total_pages: 1,
    });
    offlineTrackDownloadMocks.downloadTrackForOffline.mockImplementationOnce(async () => {
      controller.abort();
      return {
        status: "downloaded",
        trackId: "track-1",
        title: "First",
        downloadedBytes: 1024,
        downloadedTrack: {
          id: "track-1",
          title: "First",
          artist: "Artist A",
          audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
          downloadedAt: "2026-06-15T12:00:00.000Z",
          sizeBytes: 1024,
        },
        createdNativeFiles: {
          audio: false,
          artwork: false,
        },
      };
    });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({
      mode: "lan",
      signal: controller.signal,
    });

    expect(result.cancelled).toBe(true);
    expect(result.downloadedCount).toBe(1);
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).toHaveBeenCalledTimes(1);
  });

  it("uses native SQLite metadata persistence on Android without storing raw PC paths", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(true);
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [{ id: "track-1", title: "Native Save" }],
      total_items: 1,
      total_pages: 1,
    });
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValueOnce({
      status: "downloaded",
      trackId: "track-1",
      title: "Native Save",
      downloadedBytes: 1024,
      downloadedTrack: {
        id: "track-1",
        title: "Native Save",
        artist: "Artist A",
        album: "Album A",
        duration: 123,
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: "media/artwork/track-1.jpg",
        downloadedAt: "2026-06-15T12:00:00.000Z",
        file_path: "S:\\Music\\native-save.mp3",
      },
      createdNativeFiles: {
        audio: true,
        artwork: true,
      },
    });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.downloadedCount).toBe(1);
    expect(mobileOfflineRepositoryMocks.saveOfflineTrackMetadata).toHaveBeenCalledWith({
      id: "track-1",
      title: "Native Save",
      artist: "Artist A",
      album: "Album A",
      duration: 123,
      downloadStatus: "downloaded",
      storageType: "native_file",
      downloadedAt: "2026-06-15T12:00:00.000Z",
    });
    expect(mobileOfflineRepositoryMocks.saveOfflineTrackMetadata).not.toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: "S:\\Music\\native-save.mp3",
      }),
    );
  });

  it("does not call backend library routes in Offline Mode", async () => {
    const { downloadFullLibraryForOffline, getFullLibraryDownloadStatus } =
      await loadModule();

    const status = await getFullLibraryDownloadStatus({ mode: "offline" });
    const result = await downloadFullLibraryForOffline({ mode: "offline" });

    expect(status.blockedByMode).toBe(true);
    expect(result.blocked).toBe(true);
    expect(backendLibrarySourceMocks.backendLibrarySource.getAllTracks).not.toHaveBeenCalled();
  });

  it("handles an empty backend library with a controlled success state", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [],
      total_items: 0,
      total_pages: 1,
    });

    const { downloadFullLibraryForOffline, getFullLibraryDownloadStatus } =
      await loadModule();
    const status = await getFullLibraryDownloadStatus({ mode: "lan" });
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(status).toEqual(
      expect.objectContaining({
        available: true,
        totalLibraryTracks: 0,
        alreadyDownloadedCount: 0,
        missingDownloadCount: 0,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        blocked: false,
        cancelled: false,
        totalLibraryTracks: 0,
        totalMissingTracks: 0,
        downloadedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      }),
    );
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).not.toHaveBeenCalled();
  });

  it("returns a controlled library_unavailable error when backend track fetch fails", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockRejectedValue(
      new Error("backend offline"),
    );

    const { downloadFullLibraryForOffline, getFullLibraryDownloadStatus } =
      await loadModule();
    const status = await getFullLibraryDownloadStatus({ mode: "lan" });
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(status.available).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({
        blocked: false,
        blockedByMode: false,
        error: "library_unavailable",
        cancelled: false,
      }),
    );
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).not.toHaveBeenCalled();
  });

  it("does not call the backend if cancellation happens before the full-library job starts", async () => {
    const controller = new AbortController();
    controller.abort();

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({
      mode: "lan",
      signal: controller.signal,
    });

    expect(result).toEqual(
      expect.objectContaining({
        blocked: false,
        cancelled: true,
        downloadedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      }),
    );
    expect(backendLibrarySourceMocks.backendLibrarySource.getAllTracks).not.toHaveBeenCalled();
    expect(offlineTrackDownloadMocks.downloadTrackForOffline).not.toHaveBeenCalled();
  });

  it("does not overwrite playlist memberships in browser fallback full-library downloads", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue({
      items: [{ id: "track-1", title: "Browser Keep Playlist" }],
      total_items: 1,
      total_pages: 1,
    });
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValueOnce({
      status: "downloaded",
      trackId: "track-1",
      title: "Browser Keep Playlist",
      downloadedBytes: 1024,
      downloadedTrack: {
        id: "track-1",
        title: "Browser Keep Playlist",
        artist: "Artist A",
        audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
        artworkBlob: null,
        downloadedAt: "2026-06-15T12:00:00.000Z",
        sizeBytes: 1024,
        file_path: "S:\\Music\\browser-keep.mp3",
      },
      createdNativeFiles: {
        audio: false,
        artwork: false,
      },
    });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.downloadedCount).toBe(1);
    expect(offlineStorageMocks.saveOfflineTrack).toHaveBeenCalledWith(
      expect.not.objectContaining({
        playlistIds: [],
      }),
    );
    expect(offlineStorageMocks.saveOfflineTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: "S:\\Music\\browser-keep.mp3",
      }),
    );
  });
});
