import { beforeEach, describe, expect, it, vi } from "vitest";

const resolverMocks = {
  resolveTrackPlaybackSource: vi.fn(),
  resolveTrackArtworkSource: vi.fn(),
};

vi.mock("../context/playbackSourceResolver", () => resolverMocks);

async function loadModuleWithReactMocks({ useEffect, useState }) {
  vi.resetModules();
  vi.doMock("react", async () => {
    const actual = await vi.importActual("react");

    return {
      ...actual,
      useEffect,
      useState,
    };
  });

  return import("./usePlayerTrackSources.js");
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("usePlayerTrackSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets source state, clears playback errors, and loads track sources", async () => {
    const setStreamUrl = vi.fn();
    const setArtworkUrl = vi.fn();
    const setStreamError = vi.fn();
    const clearPlaybackError = vi.fn();
    const revokePlayback = vi.fn();
    const revokeArtwork = vi.fn();
    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setStreamUrl,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setArtworkUrl,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setStreamError,
      ]);
    let cleanup;
    const useEffect = vi.fn((effect) => {
      cleanup = effect();
    });

    resolverMocks.resolveTrackPlaybackSource.mockResolvedValue({
      url: "blob:track-audio",
      revoke: revokePlayback,
    });
    resolverMocks.resolveTrackArtworkSource.mockResolvedValue({
      url: "blob:track-artwork",
      revoke: revokeArtwork,
    });

    const { usePlayerTrackSources } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    usePlayerTrackSources({
      currentTrack: { id: "track-1", track_id: "track-1", offline: false },
      currentTrackId: "track-1",
      clearPlaybackError,
    });

    await flushMicrotasks();

    expect(clearPlaybackError).toHaveBeenCalledTimes(1);
    expect(setStreamUrl).toHaveBeenNthCalledWith(1, "");
    expect(setArtworkUrl).toHaveBeenNthCalledWith(1, "");
    expect(setStreamError).toHaveBeenNthCalledWith(1, "");
    expect(resolverMocks.resolveTrackPlaybackSource).toHaveBeenCalledWith({
      id: "track-1",
      track_id: "track-1",
      offline: false,
    });
    expect(resolverMocks.resolveTrackArtworkSource).toHaveBeenCalledWith({
      id: "track-1",
      track_id: "track-1",
      offline: false,
    });
    expect(setStreamUrl).toHaveBeenLastCalledWith("blob:track-audio");
    expect(setArtworkUrl).toHaveBeenLastCalledWith("blob:track-artwork");

    cleanup();

    expect(revokePlayback).toHaveBeenCalledTimes(1);
    expect(revokeArtwork).toHaveBeenCalledTimes(1);
  });

  it("does not try to load sources when there is no current track", async () => {
    const clearPlaybackError = vi.fn();
    const setStreamUrl = vi.fn();
    const setArtworkUrl = vi.fn();
    const setStreamError = vi.fn();
    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setStreamUrl,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setArtworkUrl,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setStreamError,
      ]);
    const useEffect = vi.fn((effect) => effect());

    const { usePlayerTrackSources } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    usePlayerTrackSources({
      currentTrack: null,
      currentTrackId: null,
      clearPlaybackError,
    });

    expect(clearPlaybackError).toHaveBeenCalledTimes(1);
    expect(setStreamUrl).toHaveBeenCalledWith("");
    expect(setArtworkUrl).toHaveBeenCalledWith("");
    expect(setStreamError).toHaveBeenCalledWith("");
    expect(resolverMocks.resolveTrackPlaybackSource).not.toHaveBeenCalled();
    expect(resolverMocks.resolveTrackArtworkSource).not.toHaveBeenCalled();
  });

  it("stores a controlled stream error when source resolution fails", async () => {
    const clearPlaybackError = vi.fn();
    const setStreamUrl = vi.fn();
    const setArtworkUrl = vi.fn();
    const setStreamError = vi.fn();
    const useState = vi
      .fn()
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setStreamUrl,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setArtworkUrl,
      ])
      .mockImplementationOnce((initializer) => [
        typeof initializer === "function" ? initializer() : initializer,
        setStreamError,
      ]);
    const useEffect = vi.fn((effect) => effect());

    resolverMocks.resolveTrackPlaybackSource.mockRejectedValue(
      new Error("Broken track source"),
    );
    resolverMocks.resolveTrackArtworkSource.mockResolvedValue({
      url: "blob:unused",
    });

    const { usePlayerTrackSources } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    usePlayerTrackSources({
      currentTrack: { id: "track-2", track_id: "track-2", offline: true },
      currentTrackId: "track-2",
      clearPlaybackError,
    });

    await flushMicrotasks();

    expect(setStreamError).toHaveBeenLastCalledWith("Broken track source");
  });
});
