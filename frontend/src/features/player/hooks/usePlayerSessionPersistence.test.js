import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadModuleWithReactMocks({
  useCallback,
  useEffect,
  useRef,
  useState,
}) {
  vi.resetModules();
  vi.doMock("react", async () => {
    const actual = await vi.importActual("react");

    return {
      ...actual,
      useCallback,
      useEffect,
      useRef,
      useState,
    };
  });

  return import("./usePlayerSessionPersistence.js");
}

describe("usePlayerSessionPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores a valid saved session and applies the restored playback time", async () => {
    const setQueue = vi.fn();
    const setCurrentIndex = vi.fn();
    const setShuffleEnabled = vi.fn();
    const setRepeatMode = vi.fn();
    const setIsPlaying = vi.fn();
    const setHasHydratedSession = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const windowAddEventListener = vi.fn();
    const windowRemoveEventListener = vi.fn();
    const registeredHandlers = {};
    const audioElement = {
      currentTime: 0,
      duration: 120,
      addEventListener: vi.fn((eventName, handler) => {
        registeredHandlers[eventName] = handler;
        addEventListener(eventName, handler);
      }),
      removeEventListener,
    };
    const restoredCurrentTimeRef = { current: null };
    const lastCurrentTimeSaveRef = { current: 0 };
    const hasAppliedRestoredTimeRef = { current: false };
    const hasHydratedSessionRef = { current: false };
    const useRef = vi
      .fn()
      .mockImplementationOnce(() => restoredCurrentTimeRef)
      .mockImplementationOnce(() => lastCurrentTimeSaveRef)
      .mockImplementationOnce(() => hasAppliedRestoredTimeRef)
      .mockImplementationOnce(() => hasHydratedSessionRef);
    const useState = vi.fn(() => [false, setHasHydratedSession]);
    const useEffect = vi.fn((effect) => effect());
    const useCallback = vi.fn((callback) => callback);
    let intervalCallback = null;
    const setIntervalMock = vi.fn((callback) => {
      intervalCallback = callback;
      return 1;
    });
    const clearIntervalMock = vi.fn();
    const savedSession = {
      version: 2,
      queue: [{ id: "track-1", track_id: "track-1", title: "Track 1" }],
      currentIndex: 0,
      currentTime: 45,
      shuffleEnabled: true,
      repeatMode: "track",
    };
    const localStorage = {
      getItem: vi.fn(() => JSON.stringify(savedSession)),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };

    globalThis.window = {
      localStorage,
      addEventListener: windowAddEventListener,
      removeEventListener: windowRemoveEventListener,
    };
    globalThis.setInterval = setIntervalMock;
    globalThis.clearInterval = clearIntervalMock;

    const { usePlayerSessionPersistence } = await loadModuleWithReactMocks({
      useCallback,
      useEffect,
      useRef,
      useState,
    });

    usePlayerSessionPersistence({
      audioRef: { current: audioElement },
      queue: [],
      currentIndex: -1,
      shuffleEnabled: false,
      repeatMode: "off",
      setQueue,
      setCurrentIndex,
      setShuffleEnabled,
      setRepeatMode,
      setIsPlaying,
      isTrackPlayable: (track) => Boolean(track?.track_id ?? track?.id),
      validRepeatModes: new Set(["off", "track", "playlist"]),
    });

    intervalCallback();

    expect(setQueue).toHaveBeenCalledWith(savedSession.queue);
    expect(setCurrentIndex).toHaveBeenCalledWith(0);
    expect(setShuffleEnabled).toHaveBeenCalledWith(true);
    expect(setRepeatMode).toHaveBeenCalledWith("track");
    expect(setIsPlaying).toHaveBeenCalledWith(false);
    expect(setHasHydratedSession).toHaveBeenCalledWith(true);
    expect(windowAddEventListener).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );

    registeredHandlers.loadedmetadata();

    expect(audioElement.currentTime).toBe(45);
    expect(hasAppliedRestoredTimeRef.current).toBe(true);
    expect(restoredCurrentTimeRef.current).toBe(null);
  });

  it("clears invalid saved sessions instead of restoring them", async () => {
    const setQueue = vi.fn();
    const setCurrentIndex = vi.fn();
    const setShuffleEnabled = vi.fn();
    const setRepeatMode = vi.fn();
    const setIsPlaying = vi.fn();
    const setHasHydratedSession = vi.fn();
    const useRef = vi
      .fn()
      .mockImplementationOnce(() => ({ current: null }))
      .mockImplementationOnce(() => ({ current: 0 }))
      .mockImplementationOnce(() => ({ current: false }))
      .mockImplementationOnce(() => ({ current: false }));
    const useState = vi.fn(() => [false, setHasHydratedSession]);
    const useEffect = vi.fn((effect) => effect());
    const useCallback = vi.fn((callback) => callback);
    const localStorage = {
      getItem: vi.fn(
        () =>
          JSON.stringify({
            version: 2,
            queue: [{ id: "track-1" }],
            currentIndex: 0,
            currentTime: 10,
            shuffleEnabled: true,
            repeatMode: "invalid",
          }),
      ),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };

    globalThis.window = {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    let intervalCallback = null;
    globalThis.setInterval = vi.fn((callback) => {
      intervalCallback = callback;
      return 1;
    });
    globalThis.clearInterval = vi.fn();

    const { usePlayerSessionPersistence } = await loadModuleWithReactMocks({
      useCallback,
      useEffect,
      useRef,
      useState,
    });

    usePlayerSessionPersistence({
      audioRef: { current: null },
      queue: [],
      currentIndex: -1,
      shuffleEnabled: false,
      repeatMode: "off",
      setQueue,
      setCurrentIndex,
      setShuffleEnabled,
      setRepeatMode,
      setIsPlaying,
      isTrackPlayable: () => true,
      validRepeatModes: new Set(["off", "track", "playlist"]),
    });

    intervalCallback();

    expect(localStorage.removeItem).toHaveBeenCalledWith(
      "smart-music-player-session",
    );
    expect(setQueue).not.toHaveBeenCalled();
    expect(setCurrentIndex).not.toHaveBeenCalled();
    expect(setShuffleEnabled).not.toHaveBeenCalled();
    expect(setRepeatMode).not.toHaveBeenCalled();
    expect(setIsPlaying).not.toHaveBeenCalled();
    expect(setHasHydratedSession).toHaveBeenCalledWith(true);
  });

  it("saves the hydrated session for the current queue", async () => {
    const setHasHydratedSession = vi.fn();
    const useRef = vi
      .fn()
      .mockImplementationOnce(() => ({ current: null }))
      .mockImplementationOnce(() => ({ current: 0 }))
      .mockImplementationOnce(() => ({ current: false }))
      .mockImplementationOnce(() => ({ current: false }));
    const useState = vi.fn(() => [true, setHasHydratedSession]);
    const useEffect = vi.fn((effect) => effect());
    const useCallback = vi.fn((callback) => callback);
    const localStorage = {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    const audioElement = {
      currentTime: 33,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    globalThis.window = {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    let intervalCallback = null;
    globalThis.setInterval = vi.fn((callback) => {
      intervalCallback = callback;
      return 1;
    });
    globalThis.clearInterval = vi.fn();

    const { usePlayerSessionPersistence } = await loadModuleWithReactMocks({
      useCallback,
      useEffect,
      useRef,
      useState,
    });

    usePlayerSessionPersistence({
      audioRef: { current: audioElement },
      queue: [
        {
          id: "track-9",
          track_id: "track-9",
          title: "Track 9",
          artist: "Artist 9",
          offline: false,
        },
      ],
      currentIndex: 0,
      shuffleEnabled: true,
      repeatMode: "playlist",
      setQueue: vi.fn(),
      setCurrentIndex: vi.fn(),
      setShuffleEnabled: vi.fn(),
      setRepeatMode: vi.fn(),
      setIsPlaying: vi.fn(),
      isTrackPlayable: () => true,
      validRepeatModes: new Set(["off", "track", "playlist"]),
    });

    intervalCallback();

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "smart-music-player-session",
      expect.any(String),
    );

    const savedPayload = JSON.parse(localStorage.setItem.mock.calls[0][1]);

    expect(savedPayload.version).toBe(2);
    expect(savedPayload.currentIndex).toBe(0);
    expect(savedPayload.currentTime).toBe(33);
    expect(savedPayload.shuffleEnabled).toBe(true);
    expect(savedPayload.repeatMode).toBe("playlist");
    expect(savedPayload.queue).toEqual([
      {
        id: "track-9",
        track_id: "track-9",
        playlist_track_id: null,
        title: "Track 9",
        artist: "Artist 9",
        album: null,
        duration: null,
        offline: false,
        storageType: null,
        audioSrc: null,
        artworkSrc: null,
        audioLocalUri: null,
        artworkLocalUri: null,
        audioBlobId: null,
        artworkBlobId: null,
      },
    ]);
  });
});
