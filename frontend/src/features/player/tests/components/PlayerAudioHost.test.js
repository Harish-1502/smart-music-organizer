import { beforeEach, describe, expect, it, vi } from "vitest";

let currentPlayerState;

vi.mock("../../context/PlayerContext", () => ({
  usePlayer: () => currentPlayerState,
}));

async function loadModule() {
  vi.resetModules();
  vi.doMock("react", async () => {
    const actual = await vi.importActual("react");

    return {
      ...actual,
      useEffect: (effect) => effect(),
    };
  });

  return import("../../components/PlayerAudioHost.jsx");
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PlayerAudioHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPlayerState = null;
  });

  it("reports shared playback errors when audio.play() rejects", async () => {
    const audioElement = {
      play: vi.fn(() => Promise.reject(new Error("Playback blocked"))),
      pause: vi.fn(),
    };
    const clearPlaybackError = vi.fn();
    const reportPlaybackError = vi.fn();
    const handleEnded = vi.fn();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    currentPlayerState = {
      audioRef: { current: audioElement },
      currentTrack: { id: "track-1" },
      streamUrl: "blob:track-1",
      isPlaying: true,
      handleEnded,
      reportPlaybackError,
      clearPlaybackError,
    };

    const { default: PlayerAudioHost } = await loadModule();

    PlayerAudioHost();
    await flushMicrotasks();

    expect(clearPlaybackError).toHaveBeenCalledTimes(1);
    expect(audioElement.play).toHaveBeenCalledTimes(1);
    expect(reportPlaybackError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Playback blocked" }),
      audioElement,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Audio playback failed:",
      expect.objectContaining({ message: "Playback blocked" }),
    );
    expect(clearPlaybackError.mock.invocationCallOrder[0]).toBeLessThan(
      reportPlaybackError.mock.invocationCallOrder[0],
    );

    consoleErrorSpy.mockRestore();
  });

  it("reports shared playback errors when audio.play() throws synchronously", async () => {
    const audioElement = {
      play: vi.fn(() => {
        throw new Error("Synchronous play failure");
      }),
      pause: vi.fn(),
    };
    const clearPlaybackError = vi.fn();
    const reportPlaybackError = vi.fn();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    currentPlayerState = {
      audioRef: { current: audioElement },
      currentTrack: { id: "track-2" },
      streamUrl: "blob:track-2",
      isPlaying: true,
      handleEnded: vi.fn(),
      reportPlaybackError,
      clearPlaybackError,
    };

    const { default: PlayerAudioHost } = await loadModule();

    PlayerAudioHost();

    expect(clearPlaybackError).toHaveBeenCalledTimes(1);
    expect(reportPlaybackError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Synchronous play failure" }),
      audioElement,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Audio playback failed:",
      expect.objectContaining({ message: "Synchronous play failure" }),
    );

    consoleErrorSpy.mockRestore();
  });
});
