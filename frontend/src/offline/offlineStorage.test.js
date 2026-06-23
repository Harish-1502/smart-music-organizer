import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = {
  getAll: vi.fn(),
};

vi.mock("./offlineDb", () => ({
  OFFLINE_AUDIO_BLOBS_STORE: "offline_audio_blobs",
  OFFLINE_ARTWORK_BLOBS_STORE: "offline_artwork_blobs",
  OFFLINE_PLAYLISTS_STORE: "offline_playlists",
  OFFLINE_TRACKS_STORE: "offline_tracks",
  getOfflineDatabase: vi.fn(async () => databaseMocks),
}));

async function loadModule() {
  return import("./offlineStorage.js");
}

describe("offlineStorage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    databaseMocks.getAll.mockImplementation(async (storeName) => {
      if (storeName === "offline_playlists") {
        return [{ id: "playlist-1" }];
      }

      if (storeName === "offline_tracks") {
        return [
          {
            id: "track-1",
            audioBlobId: "track:track-1:audio",
            artworkBlobId: "track:track-1:artwork",
          },
          {
            id: "track-2",
            audioBlobId: "track:track-2:audio",
            artworkBlobId: null,
          },
        ];
      }

      if (storeName === "offline_audio_blobs") {
        return [
          {
            id: "track:track-1:audio",
            blob: new Blob(["audio-1"]),
          },
        ];
      }

      if (storeName === "offline_artwork_blobs") {
        return [
          {
            id: "track:track-1:artwork",
            blob: new Blob(["art"]),
          },
        ];
      }

      return [];
    });
  });

  it("builds the browser IndexedDB summary from stored blobs", async () => {
    const { getOfflineStorageSummary } = await loadModule();
    const summary = await getOfflineStorageSummary();

    expect(summary).toEqual({
      available: true,
      playlistCount: 1,
      trackCount: 2,
      storageType: "indexeddb",
      audioBlobCount: 1,
      artworkBlobCount: 1,
      totalAudioBytes: 7,
      totalArtworkBytes: 3,
      missingAudioFileCount: 1,
      missingArtworkFileCount: 0,
      missingFileCount: 1,
      totalBytes: 10,
    });
  });

  it("verifies browser offline tracks in bulk from IndexedDB blobs", async () => {
    const { getBulkDownloadedTrackVerification } = await loadModule();
    const verificationMap = await getBulkDownloadedTrackVerification([
      "track-1",
      "track-2",
      "track-3",
    ]);

    expect(verificationMap.get("track-1")).toEqual(
      expect.objectContaining({
        trackId: "track-1",
        hasTrackRow: true,
        hasAudioRef: true,
        hasArtworkRef: true,
        sizeBytes: 7,
        verified: true,
        brokenLocalRef: false,
      }),
    );
    expect(verificationMap.get("track-2")).toEqual(
      expect.objectContaining({
        trackId: "track-2",
        hasTrackRow: true,
        hasAudioRef: true,
        verified: false,
        brokenLocalRef: true,
      }),
    );
    expect(verificationMap.get("track-3")).toEqual(
      expect.objectContaining({
        trackId: "track-3",
        hasTrackRow: false,
        hasAudioRef: false,
        verified: false,
      }),
    );
  });
});
