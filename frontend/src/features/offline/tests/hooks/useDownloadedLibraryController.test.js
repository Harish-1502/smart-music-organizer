import { beforeEach, describe, expect, it, vi } from "vitest";

const appModeMocks = {
  getAppMode: vi.fn(),
  isLanMode: vi.fn((mode) => mode === "lan"),
  subscribeToAppModeChanges: vi.fn(() => () => {}),
};

const downloadLibraryMocks = {
  cancelFullLibraryDownload: vi.fn(),
  downloadFullLibraryForOffline: vi.fn(),
  getFullLibraryDownloadRuntimeState: vi.fn(),
  getFullLibraryDownloadStatus: vi.fn(),
  subscribeToFullLibraryDownloadState: vi.fn(() => () => {}),
};

vi.mock("../../../../appMode/appMode", () => appModeMocks);
vi.mock("../../services/downloadLibrary", () => downloadLibraryMocks);

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

  return import("../../hooks/useDownloadedLibraryController.js");
}

function createUseStateMock() {
  const setters = {
    setAppMode: vi.fn(),
    setLibraryStatus: vi.fn(),
    setIsLibraryLoading: vi.fn(),
    setIsLibraryDownloading: vi.fn(),
    setLibraryProgress: vi.fn(),
  };
  const useState = vi
    .fn()
    .mockImplementationOnce((initializer) => [
      typeof initializer === "function" ? initializer() : initializer,
      setters.setAppMode,
    ])
    .mockImplementationOnce((initializer) => [
      typeof initializer === "function" ? initializer() : initializer,
      setters.setLibraryStatus,
    ])
    .mockImplementationOnce((initializer) => [
      typeof initializer === "function" ? initializer() : initializer,
      setters.setIsLibraryLoading,
    ])
    .mockImplementationOnce((initializer) => [
      typeof initializer === "function" ? initializer() : initializer,
      setters.setIsLibraryDownloading,
    ])
    .mockImplementationOnce((initializer) => [
      typeof initializer === "function" ? initializer() : initializer,
      setters.setLibraryProgress,
    ]);

  return { useState, setters };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useDownloadedLibraryController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeMocks.getAppMode.mockReturnValue("lan");
    appModeMocks.isLanMode.mockImplementation((mode) => mode === "lan");
    appModeMocks.subscribeToAppModeChanges.mockImplementation(() => () => {});
    downloadLibraryMocks.cancelFullLibraryDownload.mockReset();
    downloadLibraryMocks.downloadFullLibraryForOffline.mockReset();
    downloadLibraryMocks.getFullLibraryDownloadStatus.mockReset();
    downloadLibraryMocks.subscribeToFullLibraryDownloadState.mockImplementation(
      () => () => {},
    );
    downloadLibraryMocks.getFullLibraryDownloadRuntimeState.mockReturnValue({
      isRunning: false,
      progress: null,
      lastResult: null,
    });
  });

  it("loads full-library status in LAN mode and exposes runtime defaults", async () => {
    const runtimeProgress = {
      processedMissingTracks: 1,
      totalMissingTracks: 4,
    };
    const nextLibraryStatus = {
      available: true,
      blockedByMode: false,
      totalLibraryTracks: 25,
      alreadyDownloadedCount: 5,
      missingDownloadCount: 20,
      estimatedSizeAvailable: false,
      error: null,
    };
    const { useState, setters } = createUseStateMock();
    const useEffect = vi.fn((effect) => effect());

    downloadLibraryMocks.getFullLibraryDownloadRuntimeState.mockReturnValue({
      isRunning: true,
      progress: runtimeProgress,
      lastResult: null,
    });
    downloadLibraryMocks.getFullLibraryDownloadStatus.mockResolvedValue(
      nextLibraryStatus,
    );

    const { useDownloadedLibraryController } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    const result = useDownloadedLibraryController({});
    await flushMicrotasks();

    expect(result.lanModeEnabled).toBe(true);
    expect(result.isLibraryDownloading).toBe(false);
    expect(result.libraryProgress).toEqual(runtimeProgress);
    expect(downloadLibraryMocks.getFullLibraryDownloadStatus).toHaveBeenCalledWith(
      { mode: "lan" },
    );
    expect(setters.setLibraryStatus).toHaveBeenCalledWith(nextLibraryStatus);
    expect(setters.setIsLibraryLoading).toHaveBeenNthCalledWith(1, true);
    expect(setters.setIsLibraryLoading).toHaveBeenLastCalledWith(false);
  });

  it("sets a blocked-by-mode status and skips loading when LAN mode is disabled", async () => {
    const { useState, setters } = createUseStateMock();
    const useEffect = vi.fn((effect) => effect());

    appModeMocks.getAppMode.mockReturnValue("offline");
    appModeMocks.isLanMode.mockImplementation((mode) => mode === "lan");

    const { useDownloadedLibraryController } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    const result = useDownloadedLibraryController({});
    await flushMicrotasks();

    expect(result.lanModeEnabled).toBe(false);
    expect(downloadLibraryMocks.getFullLibraryDownloadStatus).not.toHaveBeenCalled();
    expect(setters.setLibraryStatus).toHaveBeenCalledWith({
      available: false,
      blockedByMode: true,
      totalLibraryTracks: 0,
      alreadyDownloadedCount: 0,
      missingDownloadCount: 0,
      estimatedSizeAvailable: false,
      error: null,
      lastSafeErrorMessage: "",
    });
    expect(setters.setIsLibraryLoading).toHaveBeenCalledWith(false);
  });

  it("syncs runtime download progress from the shared full-library subscription", async () => {
    const runtimeState = {
      isRunning: true,
      progress: {
        processedMissingTracks: 3,
        totalMissingTracks: 7,
      },
    };
    const { useState, setters } = createUseStateMock();
    const useEffect = vi.fn((effect) => effect());

    downloadLibraryMocks.getFullLibraryDownloadStatus.mockResolvedValue({
      available: true,
      blockedByMode: false,
      totalLibraryTracks: 12,
      alreadyDownloadedCount: 4,
      missingDownloadCount: 8,
      estimatedSizeAvailable: false,
      error: null,
    });
    downloadLibraryMocks.subscribeToFullLibraryDownloadState.mockImplementation(
      (callback) => {
        callback(runtimeState);
        return () => {};
      },
    );

    const { useDownloadedLibraryController } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    useDownloadedLibraryController({});
    await flushMicrotasks();

    expect(setters.setIsLibraryDownloading).toHaveBeenCalledWith(true);
    expect(setters.setLibraryProgress).toHaveBeenCalledWith(runtimeState.progress);
  });

  it("reports the full-library download summary and refreshes status after success", async () => {
    const clearMessage = vi.fn();
    const onRefreshOfflineData = vi.fn();
    const showErrorMessage = vi.fn();
    const { useState } = createUseStateMock();
    const useEffect = vi.fn((effect) => effect());

    downloadLibraryMocks.getFullLibraryDownloadStatus.mockResolvedValue({
      available: true,
      blockedByMode: false,
      totalLibraryTracks: 40,
      alreadyDownloadedCount: 10,
      missingDownloadCount: 30,
      estimatedSizeAvailable: false,
      error: null,
    });
    downloadLibraryMocks.downloadFullLibraryForOffline.mockResolvedValue({
      blockedByMode: false,
      error: null,
      cancelled: false,
      totalLibraryTracks: 40,
      totalMissingTracks: 30,
      verifiedExistingCount: 10,
      downloadedCount: 28,
      skippedCount: 2,
      failedCount: 0,
      lastSafeErrorMessage: "",
    });

    const { useDownloadedLibraryController } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    const result = useDownloadedLibraryController({
      initialAppMode: "lan",
      initialLibraryStatus: {
        available: true,
        blockedByMode: false,
        totalLibraryTracks: 40,
        alreadyDownloadedCount: 10,
        missingDownloadCount: 30,
        estimatedSizeAvailable: false,
        error: null,
      },
      initialLoading: false,
      onRefreshOfflineData,
      clearMessage,
      showErrorMessage,
    });

    await flushMicrotasks();
    clearMessage.mockClear();
    onRefreshOfflineData.mockClear();
    downloadLibraryMocks.getFullLibraryDownloadStatus.mockClear();

    await result.handleDownloadFullLibrary();

    expect(clearMessage).toHaveBeenCalledTimes(1);
    expect(
      downloadLibraryMocks.downloadFullLibraryForOffline,
    ).toHaveBeenCalledWith({ mode: "lan" });
    expect(onRefreshOfflineData).toHaveBeenCalledWith(
      "Verified 10 existing, downloaded 28 new, skipped 2, failed 0.",
      "success",
    );
    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(downloadLibraryMocks.getFullLibraryDownloadStatus).toHaveBeenCalledWith(
      { mode: "lan" },
    );
  });

  it("shows a controlled error message when the full-library download fails", async () => {
    const clearMessage = vi.fn();
    const onRefreshOfflineData = vi.fn();
    const showErrorMessage = vi.fn();
    const { useState } = createUseStateMock();
    const useEffect = vi.fn((effect) => effect());

    downloadLibraryMocks.getFullLibraryDownloadStatus.mockResolvedValue({
      available: true,
      blockedByMode: false,
      totalLibraryTracks: 6,
      alreadyDownloadedCount: 1,
      missingDownloadCount: 5,
      estimatedSizeAvailable: false,
      error: null,
    });
    downloadLibraryMocks.downloadFullLibraryForOffline.mockRejectedValue(
      new Error("network"),
    );

    const { useDownloadedLibraryController } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    const result = useDownloadedLibraryController({
      initialAppMode: "lan",
      initialLibraryStatus: {
        available: true,
        blockedByMode: false,
        totalLibraryTracks: 6,
        alreadyDownloadedCount: 1,
        missingDownloadCount: 5,
        estimatedSizeAvailable: false,
        error: null,
      },
      initialLoading: false,
      onRefreshOfflineData,
      clearMessage,
      showErrorMessage,
    });

    await flushMicrotasks();
    showErrorMessage.mockClear();
    downloadLibraryMocks.getFullLibraryDownloadStatus.mockClear();

    await result.handleDownloadFullLibrary();

    expect(onRefreshOfflineData).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith(
      "Could not download the full library for offline use.",
    );
    expect(downloadLibraryMocks.getFullLibraryDownloadStatus).toHaveBeenCalledWith(
      { mode: "lan" },
    );
  });

  it("delegates cancellation to the shared full-library download service", async () => {
    const { useState } = createUseStateMock();
    const useEffect = vi.fn((effect) => effect());

    downloadLibraryMocks.getFullLibraryDownloadStatus.mockResolvedValue({
      available: true,
      blockedByMode: false,
      totalLibraryTracks: 8,
      alreadyDownloadedCount: 2,
      missingDownloadCount: 6,
      estimatedSizeAvailable: false,
      error: null,
    });

    const { useDownloadedLibraryController } = await loadModuleWithReactMocks({
      useEffect,
      useState,
    });

    const result = useDownloadedLibraryController({
      initialAppMode: "lan",
      initialLibraryStatus: {
        available: true,
        blockedByMode: false,
        totalLibraryTracks: 8,
        alreadyDownloadedCount: 2,
        missingDownloadCount: 6,
        estimatedSizeAvailable: false,
        error: null,
      },
      initialLoading: false,
    });

    result.handleCancelFullLibraryDownload();

    expect(downloadLibraryMocks.cancelFullLibraryDownload).toHaveBeenCalledTimes(
      1,
    );
  });
});
