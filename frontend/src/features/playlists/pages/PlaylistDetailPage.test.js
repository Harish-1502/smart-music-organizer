import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlaylistDetailPage from "./PlaylistDetailPage";

const playerMocks = {
  playQueue: vi.fn(),
};

let currentAppMode = "lan";
let lastPlaylistSourceMode = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ playlistId: "playlist-1" }),
  };
});

vi.mock("../../../appMode/appMode", () => ({
  getAppMode: () => currentAppMode,
  isOfflineMode: (mode) => mode === "offline",
  subscribeToAppModeChanges: () => () => {},
}));

vi.mock("../../../playlists/playlistSource", () => ({
  getPlaylistSourceForMode: (mode) => {
    lastPlaylistSourceMode = mode;
    return {
      kind: mode === "offline" ? "offline" : "backend",
      supportsTrackRemoval: mode !== "offline",
      buildPlaybackQueue: vi.fn(),
    };
  },
}));

vi.mock("../../../context/PlayerContext", () => ({
  usePlayer: () => playerMocks,
}));

describe("PlaylistDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAppMode = "lan";
    lastPlaylistSourceMode = null;
  });

  it("keeps backend playlist actions visible in LAN Mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistDetailPage, {
          initialPlaylist: {
            id: "playlist-1",
            name: "Road Trip",
            tracks: [
              {
                id: "track-1",
                playlist_track_id: "playlist-track-1",
                position: 1,
                title: "Drive",
              },
            ],
          },
          initialLoading: false,
          initialCheckingDownloadStatus: false,
        }),
      ),
    );

    expect(lastPlaylistSourceMode).toBe("lan");
    expect(markup).toContain("Download for offline");
    expect(markup).toContain("Add Tracks");
    expect(markup).toContain("Reorder Tracks");
    expect(markup).toContain("Remove");
  });

  it("shows downloaded playlist detail and hides backend actions in Offline Mode", () => {
    currentAppMode = "offline";
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistDetailPage, {
          initialPlaylist: {
            id: "playlist-1",
            name: "Offline Road Trip",
            tracks: [
              {
                id: "track-1",
                track_id: "track-1",
                playlist_track_id: "offline:playlist-1:track-1",
                position: 1,
                title: "Drive",
                artist: "Artist A",
                album: "Album A",
                offline: true,
                audioLocalUri: "media/audio/track-1.mp3",
                file_name: "track-1.mp3",
                file_path: "S:\\Music\\drive.mp3",
              },
            ],
          },
          initialLoading: false,
          initialDownloaded: true,
          initialCheckingDownloadStatus: false,
        }),
      ),
    );

    expect(lastPlaylistSourceMode).toBe("offline");
    expect(markup).toContain("Offline Mode");
    expect(markup).toContain("Offline Road Trip");
    expect(markup).toContain("Drive");
    expect(markup).toContain("Manage Downloads");
    expect(markup).not.toContain("Download for offline");
    expect(markup).not.toContain("Add Tracks");
    expect(markup).not.toContain("Reorder Tracks");
    expect(markup).not.toContain("Remove");
    expect(markup).not.toContain("S:\\");
  });

  it("shows a controlled not-found state for a missing offline playlist", () => {
    currentAppMode = "offline";
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistDetailPage, {
          initialPlaylist: null,
          initialLoading: false,
          initialMessage: "Playlist not found.",
          initialDownloaded: true,
          initialCheckingDownloadStatus: false,
        }),
      ),
    );

    expect(markup).toContain("Playlist unavailable");
    expect(markup).toContain("Playlist not found.");
    expect(markup).not.toContain("Download for offline");
    expect(markup).not.toContain("Add Tracks");
    expect(markup).not.toContain("Reorder Tracks");
  });

  it("shows a clear empty state for an offline playlist with no downloaded tracks", () => {
    currentAppMode = "offline";
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistDetailPage, {
          initialPlaylist: {
            id: "playlist-empty",
            name: "Offline Empty",
            tracks: [],
          },
          initialLoading: false,
          initialDownloaded: true,
          initialCheckingDownloadStatus: false,
        }),
      ),
    );

    expect(markup).toContain("Offline Mode");
    expect(markup).toContain("Offline Empty");
    expect(markup).toContain("This playlist is empty");
    expect(markup).toContain(
      "No downloaded tracks are available in this offline playlist yet.",
    );
  });

  it("switches detail rendering between Offline Mode and LAN Mode without leaking stale playlist state", () => {
    currentAppMode = "offline";
    let markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistDetailPage, {
          initialPlaylist: {
            id: "playlist-1",
            name: "Offline Playlist",
            tracks: [
              {
                id: "track-offline",
                track_id: "track-offline",
                playlist_track_id: "offline:playlist-1:track-offline",
                position: 1,
                title: "Offline Track",
              },
            ],
          },
          initialLoading: false,
          initialDownloaded: true,
          initialCheckingDownloadStatus: false,
        }),
      ),
    );

    expect(markup).toContain("Offline Playlist");
    expect(markup).toContain("Manage Downloads");
    expect(markup).not.toContain("Download for offline");
    expect(lastPlaylistSourceMode).toBe("offline");

    currentAppMode = "lan";
    markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(PlaylistDetailPage, {
          initialPlaylist: {
            id: "playlist-1",
            name: "Backend Playlist",
            tracks: [
              {
                id: "track-lan",
                playlist_track_id: "playlist-track-1",
                position: 1,
                title: "LAN Track",
              },
            ],
          },
          initialLoading: false,
          initialCheckingDownloadStatus: false,
        }),
      ),
    );

    expect(markup).toContain("Backend Playlist");
    expect(markup).toContain("Download for offline");
    expect(markup).toContain("Add Tracks");
    expect(markup).toContain("Reorder Tracks");
    expect(markup).not.toContain("Manage Downloads");
    expect(markup).not.toContain("Offline Playlist");
    expect(lastPlaylistSourceMode).toBe("lan");
  });
});
