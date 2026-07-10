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
  ensureMobileOfflineDbReady: vi.fn(),
  getBulkOfflineTrackVerification: vi.fn(),
  OfflineDatabaseUnavailableError: class OfflineDatabaseUnavailableError extends Error {},
  saveOfflineTrackWithMediaRefs: vi.fn(),
  shouldUseMobileOfflineSqlite: vi.fn(),
};

const offlineStorageMocks = {
  saveOfflineTrack: vi.fn(),
};

const offlineTrackDownloadMocks = {
  cleanupCreatedNativeFiles: vi.fn(),
  downloadTrackForOffline: vi.fn(),
  isAbortError: vi.fn((error) => error?.name === "AbortError"),
};

vi.mock("../../../../appMode/appMode", () => appModeMocks);
vi.mock("../../../library/sources/backendLibrarySource", () => backendLibrarySourceMocks);
vi.mock("../../storage/mobileOfflineRepository", () => mobileOfflineRepositoryMocks);
vi.mock("../../storage/offlineStorage", () => offlineStorageMocks);
vi.mock("../../services/offlineTrackDownload", () => offlineTrackDownloadMocks);

async function loadModule() {
  return import("../../services/downloadLibrary.js");
}

describe("downloadLibrary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    appModeMocks.getAppMode.mockReturnValue("lan");
    appModeMocks.isLanMode.mockImplementation((mode) => mode === "lan");
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [],
        total_items: 0,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map(),
    );
    mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady.mockResolvedValue(
      true,
    );
    mobileOfflineRepositoryMocks.saveOfflineTrackWithMediaRefs.mockResolvedValue(
      {
        id: "track-1",
      },
    );
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      false,
    );
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
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "Existing" },
          { id: "track-2", title: "Missing" },
        ],
        total_items: 2,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map([
        [
          "track-1",
          {
            verified: true,
            hasTrackRow: true,
            hasAudioRef: true,
            brokenLocalRef: false,
            sizeBytes: 1024,
            existingTrack: { id: "track-1" },
          },
        ],
        [
          "track-2",
          {
            verified: false,
            hasTrackRow: false,
            hasAudioRef: false,
            brokenLocalRef: false,
            sizeBytes: 0,
            existingTrack: null,
          },
        ],
      ]),
    );
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

    expect(
      backendLibrarySourceMocks.backendLibrarySource.getAllTracks,
    ).toHaveBeenCalledTimes(1);
    expect(
      mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification,
    ).toHaveBeenCalledWith(["track-1", "track-2"]);
    expect(result).toEqual(
      expect.objectContaining({
        blocked: false,
        cancelled: false,
        totalLibraryTracks: 2,
        totalMissingTracks: 1,
        verifiedExistingCount: 1,
        downloadedCount: 1,
        skippedCount: 0,
        failedCount: 0,
      }),
    );
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(1);
  });

  it("re-downloads tracks when metadata exists but verified audio does not", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Needs Redownload" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map([
        [
          "track-1",
          {
            verified: false,
            hasTrackRow: true,
            hasAudioRef: true,
            brokenLocalRef: true,
            sizeBytes: 0,
            existingTrack: {
              id: "track-1",
              audioLocalUri: "media/audio/track-1.mp3",
            },
          },
        ],
      ]),
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.downloadedCount).toBe(1);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledWith(
      { id: "track-1", title: "Needs Redownload" },
      expect.objectContaining({
        abortDuringTrack: false,
        existingTrackState: expect.objectContaining({
          verified: false,
        }),
      }),
    );
  });

  it("marks audio failures as failed and continues downloading later tracks", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "Fails" },
          { id: "track-2", title: "Works" },
        ],
        total_items: 2,
        total_pages: 1,
      },
    );
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
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Audio Only" }],
        total_items: 1,
        total_pages: 1,
      },
    );
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
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "First" },
          { id: "track-2", title: "Second" },
        ],
        total_items: 2,
        total_pages: 1,
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline.mockImplementationOnce(
      async () => {
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
      },
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({
      mode: "lan",
      signal: controller.signal,
    });

    expect(result.cancelled).toBe(true);
    expect(result.downloadedCount).toBe(1);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(1);
  });

  it("allows a fresh retry after a cancelled run with a new abort state", async () => {
    const controller = new AbortController();
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "Retry After Cancel" },
          { id: "track-2", title: "Never Starts" },
        ],
        total_items: 2,
        total_pages: 1,
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline
      .mockImplementationOnce(async () => {
        controller.abort();
        return {
          status: "downloaded",
          trackId: "track-1",
          title: "Retry After Cancel",
          downloadedBytes: 0,
          downloadedTrack: {
            id: "track-1",
            title: "Retry After Cancel",
            artist: "Artist A",
            audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
            downloadedAt: "2026-06-15T12:00:00.000Z",
            sizeBytes: 0,
          },
          createdNativeFiles: {
            audio: false,
            artwork: false,
          },
        };
      })
      .mockResolvedValueOnce({
        status: "downloaded",
        trackId: "track-1",
        title: "Retry After Cancel",
        downloadedBytes: 1024,
        downloadedTrack: {
          id: "track-1",
          title: "Retry After Cancel",
          artist: "Artist A",
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
    const cancelledResult = await downloadFullLibraryForOffline({
      mode: "lan",
      signal: controller.signal,
    });
    const retryResult = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(cancelledResult.cancelled).toBe(true);
    expect(retryResult.cancelled).toBe(false);
    expect(retryResult.downloadedCount).toBe(2);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(3);
  });

  it("uses the bulk verification helper instead of per-track lookup helpers", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "One" },
          { id: "track-2", title: "Two" },
        ],
        total_items: 2,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map([
        [
          "track-1",
          {
            verified: true,
            hasTrackRow: true,
            hasAudioRef: true,
            sizeBytes: 1,
          },
        ],
        [
          "track-2",
          {
            verified: false,
            hasTrackRow: false,
            hasAudioRef: false,
            sizeBytes: 0,
          },
        ],
      ]),
    );

    const { getFullLibraryDownloadStatus } = await loadModule();
    const result = await getFullLibraryDownloadStatus({ mode: "lan" });

    expect(result.alreadyDownloadedCount).toBe(1);
    expect(result.missingDownloadCount).toBe(1);
    expect(
      mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification,
    ).toHaveBeenCalledTimes(1);
  });

  it("uses the verification map to classify broken local refs for retry", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "Verified" },
          { id: "track-2", title: "Broken" },
          { id: "track-3", title: "Missing" },
        ],
        total_items: 3,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map([
        [
          "track-1",
          {
            verified: true,
            hasTrackRow: true,
            hasAudioRef: true,
            brokenLocalRef: false,
            sizeBytes: 10,
          },
        ],
        [
          "track-2",
          {
            verified: false,
            hasTrackRow: true,
            hasAudioRef: true,
            brokenLocalRef: true,
            sizeBytes: 0,
          },
        ],
        [
          "track-3",
          {
            verified: false,
            hasTrackRow: false,
            hasAudioRef: false,
            brokenLocalRef: false,
            sizeBytes: 0,
          },
        ],
      ]),
    );

    const { getFullLibraryDownloadStatus } = await loadModule();
    const status = await getFullLibraryDownloadStatus({ mode: "lan" });

    expect(status.alreadyDownloadedCount).toBe(1);
    expect(status.missingDownloadCount).toBe(2);
    expect(status.brokenLocalRefCount).toBe(1);
  });

  it("uses native SQLite metadata persistence on Android without storing raw PC paths", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Native Save" }],
        total_items: 1,
        total_pages: 1,
      },
    );
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
        uri: "file:///data/user/0/com.harish.smartmusicorganizer/files/media/audio/track-1.mp3",
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
    expect(
      mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady,
    ).toHaveBeenCalledTimes(2);
    expect(
      mobileOfflineRepositoryMocks.saveOfflineTrackWithMediaRefs,
    ).toHaveBeenCalledWith({
      id: "track-1",
      title: "Native Save",
      artist: "Artist A",
      album: "Album A",
      duration: 123,
      downloadStatus: "downloaded",
      storageType: "native_file",
      downloadedAt: "2026-06-15T12:00:00.000Z",
      audioLocalUri: "media/audio/track-1.mp3",
      artworkLocalUri: "media/artwork/track-1.jpg",
    });
    expect(
      mobileOfflineRepositoryMocks.saveOfflineTrackWithMediaRefs,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: "S:\\Music\\native-save.mp3",
      }),
    );
    expect(
      mobileOfflineRepositoryMocks.saveOfflineTrackWithMediaRefs,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        audioLocalUri:
          "file:///data/user/0/com.harish.smartmusicorganizer/files/media/audio/track-1.mp3",
      }),
    );
  });

  it("initializes the mobile offline database before the first Android track download", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Init First" }],
        total_items: 1,
        total_pages: 1,
      },
    );

    const callOrder = [];
    mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady.mockImplementationOnce(
      async () => {
        callOrder.push("db-ready");
        return true;
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline.mockImplementationOnce(
      async () => {
        callOrder.push("download-track");
        return {
          status: "downloaded",
          trackId: "track-1",
          title: "Init First",
          downloadedBytes: 64,
          downloadedTrack: {
            id: "track-1",
            title: "Init First",
            artist: "Artist A",
            album: "Album A",
            duration: 123,
            audioLocalUri: "media/audio/track-1.mp3",
            artworkLocalUri: null,
            downloadedAt: "2026-06-22T10:00:00.000Z",
          },
          createdNativeFiles: {
            audio: true,
            artwork: false,
          },
        };
      },
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.downloadedCount).toBe(1);
    expect(callOrder).toEqual(["db-ready", "download-track"]);
  });

  it("fails before downloading audio when the Android offline database is unavailable", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady.mockRejectedValueOnce(
      new mobileOfflineRepositoryMocks.OfflineDatabaseUnavailableError(
        "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.",
      ),
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "DB Missing" }],
        total_items: 1,
        total_pages: 1,
      },
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result).toEqual(
      expect.objectContaining({
        error: "offline_database_unavailable",
        totalLibraryTracks: 1,
        downloadedCount: 0,
        failedCount: 0,
        lastSafeErrorMessage:
          "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.",
      }),
    );
    expect(
      backendLibrarySourceMocks.backendLibrarySource.getAllTracks,
    ).toHaveBeenCalledTimes(1);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).not.toHaveBeenCalled();
  });

  it("does not call backend library routes in Offline Mode", async () => {
    const { downloadFullLibraryForOffline, getFullLibraryDownloadStatus } =
      await loadModule();

    const status = await getFullLibraryDownloadStatus({ mode: "offline" });
    const result = await downloadFullLibraryForOffline({ mode: "offline" });

    expect(status.blockedByMode).toBe(true);
    expect(result.blocked).toBe(true);
    expect(
      backendLibrarySourceMocks.backendLibrarySource.getAllTracks,
    ).not.toHaveBeenCalled();
  });

  it("returns a safe failure summary when a track download throws unexpectedly", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Throws" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline.mockRejectedValueOnce(
      new Error("Socket timeout"),
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.failedCount).toBe(1);
    expect(result.cancelled).toBe(false);
    expect(result.lastSafeErrorMessage).toBe("Socket timeout");
  });

  it("allows a clean retry after a failed run", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Retry After Failure" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline
      .mockRejectedValueOnce(new Error("Socket timeout"))
      .mockResolvedValueOnce({
        status: "downloaded",
        trackId: "track-1",
        title: "Retry After Failure",
        downloadedBytes: 1024,
        downloadedTrack: {
          id: "track-1",
          title: "Retry After Failure",
          artist: "Artist A",
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
    const failedResult = await downloadFullLibraryForOffline({ mode: "lan" });
    const retryResult = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(failedResult.failedCount).toBe(1);
    expect(retryResult.failedCount).toBe(0);
    expect(retryResult.downloadedCount).toBe(1);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(2);
  });

  it("keeps one shared full-library job active across duplicate start attempts", async () => {
    let resolveDownload;
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Long Running" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDownload = () =>
            resolve({
              status: "downloaded",
              trackId: "track-1",
              title: "Long Running",
              downloadedBytes: 1024,
              downloadedTrack: {
                id: "track-1",
                title: "Long Running",
                artist: "Artist A",
                audioBlob: new Blob(["audio"], { type: "audio/mpeg" }),
                downloadedAt: "2026-06-15T12:00:00.000Z",
                sizeBytes: 1024,
              },
              createdNativeFiles: {
                audio: false,
                artwork: false,
              },
            });
        }),
    );

    const {
      downloadFullLibraryForOffline,
      getFullLibraryDownloadRuntimeState,
    } = await loadModule();

    const firstPromise = downloadFullLibraryForOffline({ mode: "lan" });
    const secondPromise = downloadFullLibraryForOffline({ mode: "lan" });
    await Promise.resolve();

    expect(getFullLibraryDownloadRuntimeState()).toEqual(
      expect.objectContaining({
        isRunning: true,
      }),
    );
    await vi.waitFor(() => {
      expect(
        offlineTrackDownloadMocks.downloadTrackForOffline,
      ).toHaveBeenCalledTimes(1);
    });

    resolveDownload();
    const [result, duplicateResult] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);

    expect(result.downloadedCount).toBe(1);
    expect(duplicateResult).toEqual(result);
    expect(getFullLibraryDownloadRuntimeState()).toEqual(
      expect.objectContaining({
        isRunning: false,
        lastResult: expect.objectContaining({
          downloadedCount: 1,
        }),
      }),
    );
  });

  it("retries database initialization on a new run after a startup database failure", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Retry DB Init" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady
      .mockRejectedValueOnce(
        new mobileOfflineRepositoryMocks.OfflineDatabaseUnavailableError(
          "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.",
        ),
      )
      .mockResolvedValueOnce(true);

    const { downloadFullLibraryForOffline } = await loadModule();
    const failedResult = await downloadFullLibraryForOffline({ mode: "lan" });
    const retryResult = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(failedResult.error).toBe("offline_database_unavailable");
    expect(failedResult.downloadedCount).toBe(0);
    expect(retryResult.downloadedCount).toBe(1);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(1);
    expect(
      mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady,
    ).toHaveBeenCalledTimes(3);
  });

  it("returns a true empty-library result only when the backend has zero tracks", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [],
        total_items: 0,
        total_pages: 1,
      },
    );

    const { getFullLibraryDownloadStatus, downloadFullLibraryForOffline } =
      await loadModule();
    const status = await getFullLibraryDownloadStatus({ mode: "lan" });
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(status).toEqual(
      expect.objectContaining({
        available: true,
        totalLibraryTracks: 0,
        missingDownloadCount: 0,
        error: null,
      }),
    );
    expect(result.totalLibraryTracks).toBe(0);
    expect(
      mobileOfflineRepositoryMocks.ensureMobileOfflineDbReady,
    ).not.toHaveBeenCalled();
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).not.toHaveBeenCalled();
  });

  it("treats abort errors as a cancelled job instead of a failed retry", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Abort Midway" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    const abortError = new Error("Offline download cancelled.");
    abortError.name = "AbortError";
    offlineTrackDownloadMocks.downloadTrackForOffline.mockRejectedValueOnce(
      abortError,
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.cancelled).toBe(true);
    expect(result.failedCount).toBe(0);
  });

  it("cleans up newly written native files when track metadata persistence fails", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Cleanup Needed" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValueOnce({
      status: "downloaded",
      trackId: "track-1",
      title: "Cleanup Needed",
      downloadedBytes: 1024,
      downloadedTrack: {
        id: "track-1",
        title: "Cleanup Needed",
        artist: "Artist A",
        album: "Album A",
        duration: 123,
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: "media/artwork/track-1.jpg",
        downloadedAt: "2026-06-15T12:00:00.000Z",
      },
      createdNativeFiles: {
        audio: true,
        artwork: true,
      },
    });
    const metadataError = new Error(
      "Track track-1 could not be saved: SQLite value duration was NaN.",
    );
    metadataError.name = "OfflineMetadataSaveError";
    mobileOfflineRepositoryMocks.saveOfflineTrackWithMediaRefs.mockRejectedValueOnce(
      metadataError,
    );

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.downloadedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.lastSafeErrorMessage).toBe(
      "Track track-1 could not be saved: SQLite value duration was NaN.",
    );
    expect(
      offlineTrackDownloadMocks.cleanupCreatedNativeFiles,
    ).toHaveBeenCalledWith({
      audio: ["track-1"],
      artwork: ["track-1"],
    });
    expect(console.error).toHaveBeenCalled();
    expect(console.error.mock.calls[0][0]).toContain(
      "[full-library-download:error]",
    );
    expect(console.error.mock.calls[0][0]).not.toContain("[object Object]");
    expect(console.error.mock.calls[0][0]).toContain(
      '"operation": "saving-track-metadata"',
    );
  });

  it("continues downloading later tracks after one metadata save failure", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [
          { id: "track-1", title: "Bad Metadata" },
          { id: "track-2", title: "Good Metadata" },
        ],
        total_items: 2,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map([
        [
          "track-1",
          {
            verified: false,
            hasTrackRow: false,
            hasAudioRef: false,
            sizeBytes: 0,
          },
        ],
        [
          "track-2",
          {
            verified: false,
            hasTrackRow: false,
            hasAudioRef: false,
            sizeBytes: 0,
          },
        ],
      ]),
    );
    offlineTrackDownloadMocks.downloadTrackForOffline
      .mockResolvedValueOnce({
        status: "downloaded",
        trackId: "track-1",
        title: "Bad Metadata",
        downloadedBytes: 1024,
        downloadedTrack: {
          id: "track-1",
          title: "Bad Metadata",
          artist: "",
          album: "",
          duration: null,
          audioLocalUri: "media/audio/track-1.mp3",
          downloadedAt: "2026-06-15T12:00:00.000Z",
        },
        createdNativeFiles: {
          audio: true,
          artwork: false,
        },
      })
      .mockResolvedValueOnce({
        status: "downloaded",
        trackId: "track-2",
        title: "Good Metadata",
        downloadedBytes: 2048,
        downloadedTrack: {
          id: "track-2",
          title: "Good Metadata",
          artist: "",
          album: "",
          duration: null,
          audioLocalUri: "media/audio/track-2.mp3",
          downloadedAt: "2026-06-15T12:00:00.000Z",
        },
        createdNativeFiles: {
          audio: true,
          artwork: false,
        },
      });
    mobileOfflineRepositoryMocks.saveOfflineTrackWithMediaRefs
      .mockRejectedValueOnce(
        (() => {
          const metadataError = new Error(
            "Track track-1 could not be saved: SQLite value duration was NaN.",
          );
          metadataError.name = "OfflineMetadataSaveError";
          return metadataError;
        })(),
      )
      .mockResolvedValueOnce({ id: "track-2" });

    const { downloadFullLibraryForOffline } = await loadModule();
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(result.failedCount).toBe(1);
    expect(result.downloadedCount).toBe(1);
    expect(result.lastSafeErrorMessage).toBe(
      "Track track-1 could not be saved: SQLite value duration was NaN.",
    );
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(2);
  });

  it("retries incomplete native tracks instead of trusting stale metadata alone", async () => {
    mobileOfflineRepositoryMocks.shouldUseMobileOfflineSqlite.mockReturnValue(
      true,
    );
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Retry Me" }],
        total_items: 1,
        total_pages: 1,
      },
    );
    mobileOfflineRepositoryMocks.getBulkOfflineTrackVerification.mockResolvedValue(
      new Map([
        [
          "track-1",
          {
            verified: false,
            hasTrackRow: true,
            hasAudioRef: true,
            brokenLocalRef: true,
            sizeBytes: 0,
            existingTrack: {
              id: "track-1",
              audioLocalUri: "media/audio/track-1.mp3",
            },
          },
        ],
      ]),
    );
    offlineTrackDownloadMocks.downloadTrackForOffline.mockResolvedValueOnce({
      status: "downloaded",
      trackId: "track-1",
      title: "Retry Me",
      downloadedBytes: 1024,
      downloadedTrack: {
        id: "track-1",
        title: "Retry Me",
        artist: "Artist A",
        album: "Album A",
        duration: 123,
        audioLocalUri: "media/audio/track-1.mp3",
        artworkLocalUri: null,
        downloadedAt: "2026-06-15T12:00:00.000Z",
      },
      createdNativeFiles: {
        audio: true,
        artwork: false,
      },
    });

    const { downloadFullLibraryForOffline, getFullLibraryDownloadStatus } =
      await loadModule();
    const status = await getFullLibraryDownloadStatus({ mode: "lan" });
    const result = await downloadFullLibraryForOffline({ mode: "lan" });

    expect(status.alreadyDownloadedCount).toBe(0);
    expect(result.downloadedCount).toBe(1);
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).toHaveBeenCalledTimes(1);
  });

  it("handles an empty backend library with a controlled success state", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [],
        total_items: 0,
        total_pages: 1,
      },
    );

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
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).not.toHaveBeenCalled();
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
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).not.toHaveBeenCalled();
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
    expect(
      backendLibrarySourceMocks.backendLibrarySource.getAllTracks,
    ).not.toHaveBeenCalled();
    expect(
      offlineTrackDownloadMocks.downloadTrackForOffline,
    ).not.toHaveBeenCalled();
  });

  it("does not overwrite playlist memberships in browser fallback full-library downloads", async () => {
    backendLibrarySourceMocks.backendLibrarySource.getAllTracks.mockResolvedValue(
      {
        items: [{ id: "track-1", title: "Browser Keep Playlist" }],
        total_items: 1,
        total_pages: 1,
      },
    );
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
