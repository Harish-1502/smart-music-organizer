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

  return import("../../hooks/usePlayerPlaybackPreferences.js");
}

describe("usePlayerPlaybackPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads persisted preferences and writes them back through effects", async () => {
    const setShuffleEnabled = vi.fn();
    const setRepeatMode = vi.fn();
    const localStorage = {
      getItem: vi.fn((key) => {
        if (key === "smart-music-organizer:shuffle-enabled") {
          return "true";
        }

        if (key === "smart-music-organizer:repeat-mode") {
          return "track";
        }

        return null;
      }),
      setItem: vi.fn(),
    };

    globalThis.window = { localStorage };

    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setShuffleEnabled,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setRepeatMode,
      ]);
    const useEffect = vi.fn((effect) => effect());

    const { usePlayerPlaybackPreferences } = await loadModuleWithReactMocks({
      useState,
      useEffect,
    });

    const preferences = usePlayerPlaybackPreferences(
      new Set(["off", "track", "playlist"]),
    );

    expect(preferences.shuffleEnabled).toBe(true);
    expect(preferences.repeatMode).toBe("track");
    expect(localStorage.getItem).toHaveBeenCalledWith(
      "smart-music-organizer:shuffle-enabled",
    );
    expect(localStorage.getItem).toHaveBeenCalledWith(
      "smart-music-organizer:repeat-mode",
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "smart-music-organizer:shuffle-enabled",
      "true",
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "smart-music-organizer:repeat-mode",
      "track",
    );
  });

  it("falls back to off when the stored repeat mode is invalid", async () => {
    const localStorage = {
      getItem: vi.fn((key) => {
        if (key === "smart-music-organizer:shuffle-enabled") {
          return "false";
        }

        if (key === "smart-music-organizer:repeat-mode") {
          return "invalid-mode";
        }

        return null;
      }),
      setItem: vi.fn(),
    };

    globalThis.window = { localStorage };

    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        vi.fn(),
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        vi.fn(),
      ]);
    const useEffect = vi.fn((effect) => effect());

    const { usePlayerPlaybackPreferences } = await loadModuleWithReactMocks({
      useState,
      useEffect,
    });

    const preferences = usePlayerPlaybackPreferences(
      new Set(["off", "track", "playlist"]),
    );

    expect(preferences.shuffleEnabled).toBe(false);
    expect(preferences.repeatMode).toBe("off");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "smart-music-organizer:repeat-mode",
      "off",
    );
  });
});
