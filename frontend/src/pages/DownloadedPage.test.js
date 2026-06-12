import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DownloadedPage, {
  buildClearAllDownloadsConfirmationText,
  buildDeleteDownloadConfirmationText,
  getMissingAudioWarningMessage,
} from "./DownloadedPage";

const playerMocks = {
  playQueue: vi.fn(),
};

vi.mock("../context/PlayerContext", () => ({
  usePlayer: () => playerMocks,
}));

vi.mock("../offline/mobileOfflineRepository", () => ({
  buildOfflinePlaybackQueue: vi.fn(),
  clearOfflineData: vi.fn(),
  deleteOfflinePlaylist: vi.fn(),
  getOfflinePlaylists: vi.fn(),
  getOfflineStorageSummary: vi.fn(),
}));

describe("DownloadedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render the temporary inspect action in the normal UI", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(DownloadedPage),
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
  });
});
