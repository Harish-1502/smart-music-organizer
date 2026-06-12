import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DownloadedPage from "./DownloadedPage";

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
  });
});
