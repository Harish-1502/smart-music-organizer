import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DownloadedPage, {
  buildClearAllDownloadsConfirmationText,
  buildDeleteDownloadConfirmationText,
  getMissingAudioWarningMessage,
  sanitizeLibraryProgressTitle,
} from "./DownloadedPage";

const playerMocks = {
  playQueue: vi.fn(),
};

let currentAppMode = "lan";

vi.mock("../../player/context/PlayerContext", () => ({
  usePlayer: () => playerMocks,
}));

vi.mock("../../../appMode/appMode", () => ({
  getAppMode: () => currentAppMode,
  isLanMode: (mode) => mode === "lan",
  subscribeToAppModeChanges: () => () => {},
}));

vi.mock("../storage/mobileOfflineRepository", () => ({
  buildOfflinePlaybackQueue: vi.fn(),
  clearOfflineData: vi.fn(),
  deleteOfflinePlaylist: vi.fn(),
  getOfflinePlaylists: vi.fn(),
  getOfflineStorageSummary: vi.fn(),
}));

vi.mock("../services/downloadLibrary", () => ({
  cancelFullLibraryDownload: vi.fn(),
  downloadFullLibraryForOffline: vi.fn(),
  getFullLibraryDownloadRuntimeState: vi.fn(() => ({
    isRunning: false,
    progress: null,
    lastResult: null,
  })),
  getFullLibraryDownloadStatus: vi.fn(),
  subscribeToFullLibraryDownloadState: vi.fn(() => () => {}),
}));

describe("DownloadedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAppMode = "lan";
  });

  it("renders the Offline Library full-library download entry point in LAN Mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 1,
            trackCount: 5,
            totalAudioBytes: 4096,
            totalArtworkBytes: 512,
            totalBytes: 4608,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: true,
            blockedByMode: false,
            totalLibraryTracks: 25,
            alreadyDownloadedCount: 5,
            missingDownloadCount: 20,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).toContain("Offline Library");
    expect(markup).toContain("Download Full Library");
    expect(markup).toContain("PC library tracks");
    expect(markup).toContain("Already downloaded");
    expect(markup).toContain("New downloads");
    expect(markup).not.toContain("Switch to LAN Mode to download from your PC library.");
  });

  it("shows the full-library action as blocked in Offline Mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "offline",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 2,
            totalAudioBytes: 2048,
            totalArtworkBytes: 256,
            totalBytes: 2304,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: false,
            blockedByMode: true,
            totalLibraryTracks: 0,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).toContain("Offline Library");
    expect(markup).toContain("Switch to LAN Mode to download from your PC library.");
    expect(markup).toContain("disabled");
  });

  it("shows a controlled empty-library note in LAN Mode when the backend library has no tracks", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 0,
            totalAudioBytes: 0,
            totalArtworkBytes: 0,
            totalBytes: 0,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: true,
            blockedByMode: false,
            totalLibraryTracks: 0,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).toContain(
      "No tracks found in your PC library right now.",
    );
  });

  it("shows a controlled unreachable-backend note in LAN Mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 0,
            totalAudioBytes: 0,
            totalArtworkBytes: 0,
            totalBytes: 0,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: false,
            blockedByMode: false,
            totalLibraryTracks: 0,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: "library_unavailable",
          },
        }),
      ),
    );

    expect(markup).toContain(
      "Connect to your PC backend in LAN Mode to inspect the full library.",
    );
  });

  it("shows a database-unavailable note without claiming the PC library is empty", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 0,
            totalAudioBytes: 0,
            totalArtworkBytes: 0,
            totalBytes: 0,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: false,
            blockedByMode: false,
            totalLibraryTracks: 476,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: "offline_database_unavailable",
          },
        }),
      ),
    );

    expect(markup).toContain(
      "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.",
    );
    expect(markup).toContain("476");
    expect(markup).not.toContain("No tracks found in your PC library right now.");
  });

  it("keeps downloaded playlist management UI alongside the new full-library section", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 1,
            trackCount: 5,
            totalAudioBytes: 4096,
            totalArtworkBytes: 512,
            totalBytes: 4608,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [
            {
              id: "playlist-1",
              name: "Road Trip",
              totalTracks: 5,
              totalBytes: 4608,
              downloadedAt: "2026-06-15T12:00:00.000Z",
            },
          ],
          initialLibraryStatus: {
            available: true,
            blockedByMode: false,
            totalLibraryTracks: 25,
            alreadyDownloadedCount: 5,
            missingDownloadCount: 20,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).toContain("Downloaded playlists");
    expect(markup).toContain("Delete Download");
    expect(markup).toContain("Clear All Downloads");
    expect(markup).toContain("Play Offline");
    expect(markup).not.toContain("S:\\");
    expect(markup).not.toContain("C:\\");
  });

  it("renders download progress with a sanitized current track title and cancel action", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialIsLibraryDownloading: true,
          initialLibraryProgress: {
            totalLibraryTracks: 20,
            totalMissingTracks: 10,
            processedMissingTracks: 2,
            verifiedExistingCount: 4,
            downloadedCount: 1,
            skippedCount: 0,
            failedCount: 1,
            downloadedBytes: 2048,
            currentTrackTitle: "S:\\Music\\secret.mp3",
          },
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 0,
            totalAudioBytes: 0,
            totalArtworkBytes: 0,
            totalBytes: 0,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: true,
            blockedByMode: false,
            totalLibraryTracks: 20,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 10,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).toContain("Downloading full library");
    expect(markup).toContain("2 / 10 missing tracks processed.");
    expect(markup).toContain("Cancel");
    expect(markup).toContain(
      "Verified existing 4, newly downloaded 1, skipped during this run 0, failed 1.",
    );
    expect(markup).toContain("Current track hidden for privacy.");
    expect(markup).not.toContain("S:\\Music\\secret.mp3");
  });

  it("shows live full-library counters from in-progress download state", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialIsLibraryDownloading: true,
          initialLibraryProgress: {
            totalLibraryTracks: 20,
            totalMissingTracks: 10,
            processedMissingTracks: 4,
            verifiedExistingCount: 4,
            downloadedCount: 3,
            skippedCount: 2,
            failedCount: 1,
            downloadedBytes: 2048,
            currentTrackTitle: "Live Counter Track",
          },
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 0,
            totalAudioBytes: 0,
            totalArtworkBytes: 0,
            totalBytes: 0,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: true,
            blockedByMode: false,
            totalLibraryTracks: 20,
            alreadyDownloadedCount: 1,
            missingDownloadCount: 10,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).toContain("Already downloaded</span><span class=\"downloaded-page__summary-value\">9");
    expect(markup).toContain("New downloads</span><span class=\"downloaded-page__summary-value\">6");
    expect(markup).toContain(
      "Verified existing 4, newly downloaded 3, skipped during this run 2, failed 1.",
    );
  });

  it("does not render the temporary inspect action in the normal UI", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage, {
          initialAppMode: "lan",
          initialLoading: false,
          initialSummary: {
            available: true,
            playlistCount: 0,
            trackCount: 0,
            totalAudioBytes: 0,
            totalArtworkBytes: 0,
            totalBytes: 0,
            storageType: "native_file",
            missingAudioFileCount: 0,
          },
          initialPlaylists: [],
          initialLibraryStatus: {
            available: true,
            blockedByMode: false,
            totalLibraryTracks: 0,
            alreadyDownloadedCount: 0,
            missingDownloadCount: 0,
            estimatedSizeAvailable: false,
            error: null,
          },
        }),
      ),
    );

    expect(markup).not.toContain("Inspect Download");
    expect(markup).toContain("Downloaded");
    expect(markup).toContain("Storage");
    expect(markup).toContain("Storage type");
    expect(markup).toContain("Offline total");
  });

  it("builds clear delete confirmation text and missing-audio warning without PC paths", () => {
    expect(buildDeleteDownloadConfirmationText("Road Trip")).toContain(
      "Delete the offline download for Road Trip?",
    );
    expect(
      buildClearAllDownloadsConfirmationText({
        playlistCount: 2,
        trackCount: 8,
        totalBytes: 7340032,
        storageType: "native_file",
      }),
    ).toContain("7.0 MB");
    expect(
      getMissingAudioWarningMessage({
        missingAudioFileCount: 2,
      }),
    ).toContain("2 offline audio files are missing");
    expect(buildDeleteDownloadConfirmationText("Road Trip")).not.toContain("S:\\");
    expect(
      buildClearAllDownloadsConfirmationText({
        playlistCount: 1,
        trackCount: 1,
        totalBytes: 0,
        storageType: "indexeddb",
      }),
    ).not.toContain("C:\\");
    expect(sanitizeLibraryProgressTitle("S:\\Music\\song.mp3")).toBe(
      "Current track hidden for privacy.",
    );
    expect(
      sanitizeLibraryProgressTitle("http://192.168.68.112:8000/tracks/1/stream"),
    ).toBe("Current track hidden for privacy.");
    expect(sanitizeLibraryProgressTitle("Real Song Title")).toBe("Real Song Title");
  });
});
