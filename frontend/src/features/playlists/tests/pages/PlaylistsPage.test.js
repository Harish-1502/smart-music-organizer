import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlaylistsPage from "../../pages/PlaylistsPage";

const sourceMocks = {
  backend: {
    kind: "backend",
    supportsCreate: true,
    supportsRename: true,
    supportsDelete: true,
  },
  offline: {
    kind: "offline",
    supportsCreate: false,
    supportsRename: false,
    supportsDelete: false,
  },
};

let currentAppMode = "lan";
let lastPlaylistSourceMode = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../../../appMode/appMode", () => ({
  getAppMode: () => currentAppMode,
  isOfflineMode: (mode) => mode === "offline",
  subscribeToAppModeChanges: () => () => {},
}));

vi.mock("../../sources/playlistSource", () => ({
  getPlaylistSourceForMode: (mode) => {
    lastPlaylistSourceMode = mode;
    return mode === "offline" ? sourceMocks.offline : sourceMocks.backend;
  },
}));

vi.mock("../../../../config/featureFlags", () => ({
  featureFlags: {
    enableAiPlaylists: true,
  },
}));

describe("PlaylistsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAppMode = "lan";
    lastPlaylistSourceMode = null;
  });

  it("uses the backend playlist source in LAN Mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [
            {
              id: "playlist-1",
              name: "Road Trip",
              updated_at: "2026-06-15T10:00:00.000Z",
            },
          ],
          initialLoading: false,
        }),
      ),
    );

    expect(lastPlaylistSourceMode).toBe("lan");
    expect(markup).toContain("Generate with AI");
    expect(markup).toContain("+ Create Playlist");
    expect(markup).toContain("Rename");
    expect(markup).toContain("Delete");
    expect(markup).toContain("Road Trip");
  });

  it("uses the offline playlist source and renders downloaded playlists in Offline Mode", () => {
    currentAppMode = "offline";
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [
            {
              id: "playlist-1",
              name: "Offline Road Trip",
              updated_at: "2026-06-15T10:00:00.000Z",
              totalTracks: 2,
              totalBytes: 2048,
              offline: true,
            },
          ],
          initialLoading: false,
        }),
      ),
    );

    expect(lastPlaylistSourceMode).toBe("offline");
    expect(markup).toContain("Offline Mode");
    expect(markup).toContain("Offline Road Trip");
    expect(markup).toContain("2 offline tracks");
    expect(markup).toContain("Downloaded page");
    expect(markup).not.toContain("+ Create Playlist");
    expect(markup).not.toContain("Generate with AI");
    expect(markup).not.toContain("Rename");
    expect(markup).not.toContain("Delete");
    expect(markup).not.toContain("S:\\");
  });

  it("shows a clear empty state in Offline Mode", () => {
    currentAppMode = "offline";
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [],
          initialLoading: false,
        }),
      ),
    );

    expect(markup).toContain("No offline playlists downloaded yet");
    expect(markup).toContain(
      "Switch to LAN Mode and download a playlist first.",
    );
  });

  it("switches from LAN Mode to Offline Mode without leaving stale backend playlists visible", () => {
    let markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [
            {
              id: "playlist-lan",
              name: "Backend Playlist",
              updated_at: "2026-06-15T10:00:00.000Z",
            },
          ],
          initialLoading: false,
        }),
      ),
    );

    expect(markup).toContain("Backend Playlist");
    expect(markup).not.toContain("Offline Playlist");
    expect(lastPlaylistSourceMode).toBe("lan");

    currentAppMode = "offline";
    markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [
            {
              id: "playlist-offline",
              name: "Offline Playlist",
              updated_at: "2026-06-16T10:00:00.000Z",
              totalTracks: 1,
              totalBytes: 512,
              offline: true,
            },
          ],
          initialLoading: false,
        }),
      ),
    );

    expect(markup).toContain("Offline Playlist");
    expect(markup).not.toContain("Backend Playlist");
    expect(markup).toContain("Offline Mode");
    expect(lastPlaylistSourceMode).toBe("offline");
  });

  it("switches from Offline Mode back to LAN Mode and restores backend playlist actions", () => {
    currentAppMode = "offline";
    let markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [
            {
              id: "playlist-offline",
              name: "Offline Playlist",
              updated_at: "2026-06-16T10:00:00.000Z",
              totalTracks: 1,
              totalBytes: 512,
              offline: true,
            },
          ],
          initialLoading: false,
        }),
      ),
    );

    expect(markup).toContain("Offline Playlist");
    expect(markup).not.toContain("+ Create Playlist");
    expect(lastPlaylistSourceMode).toBe("offline");

    currentAppMode = "lan";
    markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistsPage, {
          initialPlaylists: [
            {
              id: "playlist-lan",
              name: "Backend Playlist",
              updated_at: "2026-06-17T10:00:00.000Z",
            },
          ],
          initialLoading: false,
        }),
      ),
    );

    expect(markup).toContain("Backend Playlist");
    expect(markup).toContain("+ Create Playlist");
    expect(markup).toContain("Generate with AI");
    expect(markup).toContain("Rename");
    expect(markup).toContain("Delete");
    expect(markup).not.toContain("Offline Playlist");
    expect(lastPlaylistSourceMode).toBe("lan");
  });
});
