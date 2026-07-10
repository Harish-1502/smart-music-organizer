import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadModuleWithReactMocks({ useState, useEffect }) {
  vi.resetModules();
  vi.doMock("react", async () => {
    const actual = await vi.importActual("react");

    return {
      ...actual,
      useEffect,
      useState,
    };
  });

  return import("./usePlayerVolumeState.js");
}

describe("usePlayerVolumeState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs initial volume and mute state from the shared audio element", async () => {
    const setVolume = vi.fn();
    const setIsMuted = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setVolume,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setIsMuted,
      ]);
    const useEffect = vi.fn((effect) => effect());
    const audioRef = {
      current: {
        volume: 0.345,
        muted: true,
        addEventListener,
        removeEventListener,
      },
    };

    const { usePlayerVolumeState } = await loadModuleWithReactMocks({
      useState,
      useEffect,
    });

    usePlayerVolumeState({
      audioRef,
      currentTrack: { id: "track-1" },
    });

    expect(setVolume).toHaveBeenCalledWith(35);
    expect(setIsMuted).toHaveBeenCalledWith(true);
    expect(addEventListener).toHaveBeenCalledWith(
      "volumechange",
      expect.any(Function),
    );
  });

  it("resets to default values when no audio element is available", async () => {
    const setVolume = vi.fn();
    const setIsMuted = vi.fn();
    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setVolume,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setIsMuted,
      ]);
    const useEffect = vi.fn((effect) => effect());

    const { usePlayerVolumeState } = await loadModuleWithReactMocks({
      useState,
      useEffect,
    });

    usePlayerVolumeState({
      audioRef: { current: null },
      currentTrack: null,
    });

    expect(setVolume).toHaveBeenCalledWith(100);
    expect(setIsMuted).toHaveBeenCalledWith(false);
  });
});
