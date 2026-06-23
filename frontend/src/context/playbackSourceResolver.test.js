import { beforeEach, describe, expect, it, vi } from "vitest";

const apiBaseMocks = {
  getTrackStreamBlobUrl: vi.fn(),
};

const offlineStorageMocks = {
  createOfflineAudioBlobUrl: vi.fn(),
  createOfflineArtworkBlobUrl: vi.fn(),
};

const nativeMediaStorageMocks = {
  getPlayableNativeAudioUri: vi.fn(),
  getPlayableNativeArtworkUri: vi.fn(),
};

vi.mock("../api/apiBase", () => apiBaseMocks);
vi.mock("../offline/offlineStorage", () => offlineStorageMocks);
vi.mock("../offline/nativeMediaFileStorage", () => nativeMediaStorageMocks);

async function loadModule() {
  return import("./playbackSourceResolver.js");
}

describe("playbackSourceResolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    apiBaseMocks.getTrackStreamBlobUrl.mockResolvedValue("blob:online-stream");
    offlineStorageMocks.createOfflineAudioBlobUrl.mockResolvedValue("blob:offline-audio");
    offlineStorageMocks.createOfflineArtworkBlobUrl.mockResolvedValue("blob:offline-art");
    nativeMediaStorageMocks.getPlayableNativeAudioUri.mockResolvedValue(
      "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
    );
    nativeMediaStorageMocks.getPlayableNativeArtworkUri.mockResolvedValue(
      "http://localhost/_capacitor_file_/media/artwork/track-1.jpg",
    );
  });

  it("uses WebView-playable native offline sources without calling backend stream helpers", async () => {
    const { resolveTrackPlaybackSource, resolveTrackArtworkSource } = await loadModule();
    const playback = await resolveTrackPlaybackSource({
      id: "track-1",
      offline: true,
      audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
    });
    const artwork = await resolveTrackArtworkSource({
      id: "track-1",
      offline: true,
      artworkSrc: "http://localhost/_capacitor_file_/media/artwork/track-1.jpg",
    });

    expect(playback.url).toBe("http://localhost/_capacitor_file_/media/audio/track-1.mp3");
    expect(artwork.url).toBe("http://localhost/_capacitor_file_/media/artwork/track-1.jpg");
    expect(playback.url.startsWith("file://")).toBe(false);
    expect(apiBaseMocks.getTrackStreamBlobUrl).not.toHaveBeenCalled();
    expect(offlineStorageMocks.createOfflineAudioBlobUrl).not.toHaveBeenCalled();
    expect(offlineStorageMocks.createOfflineArtworkBlobUrl).not.toHaveBeenCalled();
  });

  it("uses IndexedDB offline blob sources without calling backend stream helpers", async () => {
    const { resolveTrackPlaybackSource, resolveTrackArtworkSource } = await loadModule();
    const playback = await resolveTrackPlaybackSource({
      id: "track-1",
      offline: true,
      audioBlobId: "track:track-1:audio",
    });
    const artwork = await resolveTrackArtworkSource({
      id: "track-1",
      offline: true,
      artworkBlobId: "track:track-1:artwork",
    });

    expect(playback.url).toBe("blob:offline-audio");
    expect(artwork.url).toBe("blob:offline-art");
    expect(offlineStorageMocks.createOfflineAudioBlobUrl).toHaveBeenCalledWith(
      "track:track-1:audio",
    );
    expect(offlineStorageMocks.createOfflineArtworkBlobUrl).toHaveBeenCalledWith(
      "track:track-1:artwork",
    );
    expect(apiBaseMocks.getTrackStreamBlobUrl).not.toHaveBeenCalled();
  });

  it("resolves native offline local URIs without calling backend stream helpers", async () => {
    const { resolveTrackPlaybackSource, resolveTrackArtworkSource } = await loadModule();
    const playback = await resolveTrackPlaybackSource({
      id: "track-1",
      offline: true,
      audioLocalUri: "media/audio/track-1.mp3",
    });
    const artwork = await resolveTrackArtworkSource({
      id: "track-1",
      offline: true,
      artworkLocalUri: "media/artwork/track-1.jpg",
    });

    expect(nativeMediaStorageMocks.getPlayableNativeAudioUri).toHaveBeenCalledWith(
      "media/audio/track-1.mp3",
    );
    expect(nativeMediaStorageMocks.getPlayableNativeArtworkUri).toHaveBeenCalledWith(
      "media/artwork/track-1.jpg",
    );
    expect(playback.url).toBe("http://localhost/_capacitor_file_/media/audio/track-1.mp3");
    expect(artwork.url).toBe("http://localhost/_capacitor_file_/media/artwork/track-1.jpg");
    expect(apiBaseMocks.getTrackStreamBlobUrl).not.toHaveBeenCalled();
  });

  it("throws a controlled error when offline audio is missing", async () => {
    offlineStorageMocks.createOfflineAudioBlobUrl.mockResolvedValue(null);

    const { resolveTrackPlaybackSource } = await loadModule();

    await expect(
      resolveTrackPlaybackSource({
        id: "track-2",
        offline: true,
        audioBlobId: "track:track-2:audio",
      }),
    ).rejects.toThrow("Downloaded audio file is missing.");
    expect(apiBaseMocks.getTrackStreamBlobUrl).not.toHaveBeenCalled();
  });

  it("uses the existing backend stream helper for online playback", async () => {
    const { resolveTrackPlaybackSource } = await loadModule();
    const playback = await resolveTrackPlaybackSource({
      id: "track-9",
      title: "Online Track",
    });

    expect(apiBaseMocks.getTrackStreamBlobUrl).toHaveBeenCalledWith("track-9");
    expect(playback.url).toBe("blob:online-stream");
    expect(playback.url.includes("api_token=")).toBe(false);
  });

  it("returns no offline artwork URL when artwork is unavailable", async () => {
    offlineStorageMocks.createOfflineArtworkBlobUrl.mockResolvedValue(null);

    const { resolveTrackArtworkSource } = await loadModule();
    const artwork = await resolveTrackArtworkSource({
      id: "track-3",
      offline: true,
      artworkBlobId: "track:track-3:artwork",
    });

    expect(artwork.url).toBe("");
  });
});
