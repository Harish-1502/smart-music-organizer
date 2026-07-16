import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = {
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => "android"),
};

const pluginMocks = {
  isAvailable: vi.fn(),
  ensureNotificationPermission: vi.fn(),
  loadQueue: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  seekTo: vi.fn(),
  setVolume: vi.fn(),
  setMuted: vi.fn(),
  setShuffleEnabled: vi.fn(),
  setRepeatMode: vi.fn(),
  getState: vi.fn(),
};

vi.mock("@capacitor/core", () => ({
  Capacitor: capacitorMocks,
  registerPlugin: vi.fn(() => pluginMocks),
}));

async function loadModule() {
  vi.resetModules();
  return import("../../native/nativeDownloadedPlayback.js");
}

describe("nativeDownloadedPlayback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("android");
  });

  it("accepts WebView-playable offline tracks", async () => {
    const {
      isNativeDownloadedPlaybackTrack,
      shouldUseNativeDownloadedPlaybackQueue,
    } = await loadModule();

    expect(
      isNativeDownloadedPlaybackTrack({
        offline: true,
        audioSrc:
          "http://localhost/_capacitor_file_/data/user/0/com.harish.smartmusicorganizer/files/media/audio/34.mp3",
      }),
    ).toBe(true);

    expect(
      shouldUseNativeDownloadedPlaybackQueue([
        {
          offline: true,
          audioSrc:
            "http://localhost/_capacitor_file_/data/user/0/com.harish.smartmusicorganizer/files/media/audio/34.mp3",
        },
      ]),
    ).toBe(true);
  });

  it("normalizes the queue payload before calling the plugin", async () => {
    const { loadNativeDownloadedPlaybackQueue } = await loadModule();

    pluginMocks.loadQueue.mockResolvedValue({
      available: true,
      active: true,
      isPlaying: true,
      currentIndex: 0,
      queueSize: 1,
    });

    await loadNativeDownloadedPlaybackQueue({
      tracks: [
        {
          id: "34",
          title: "Track 34",
          artist: "",
          album: "",
          duration: 0,
          offline: true,
          storageType: "native_file",
          audioSrc:
            "http://localhost/_capacitor_file_/data/user/0/com.harish.smartmusicorganizer/files/media/audio/34.mp3",
        },
      ],
      startIndex: 0,
      autoplay: true,
      shuffleEnabled: false,
      repeatMode: "off",
      volume: 1,
    });

    expect(pluginMocks.loadQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        startIndex: 0,
        autoplay: true,
        shuffleEnabled: false,
        repeatMode: "off",
        volume: 1,
        tracks: [
          expect.objectContaining({
            id: "34",
            offline: true,
            audioLocalUri: "media/audio/34.mp3",
            audioSrc: null,
          }),
        ],
      }),
    );
  });
});
