import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "./LibraryPage";

const sourceMocks = {
  backend: { kind: "backend" },
  offline: { kind: "offline" },
};

let currentAppMode = "lan";
let lastTrackBrowserSource = null;
let lastLibraryViewsSource = null;

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../appMode/appMode", () => ({
  getAppMode: () => currentAppMode,
  isOfflineMode: (mode) => mode === "offline",
  subscribeToAppModeChanges: () => () => {},
}));

vi.mock("../library/librarySource", () => ({
  getLibrarySourceForMode: (mode) =>
    mode === "offline" ? sourceMocks.offline : sourceMocks.backend,
}));

vi.mock("../hooks/useTrackBrowser", () => ({
  default: (source) => {
    lastTrackBrowserSource = source;

    return {
      tracks: [],
      tracksLoading: false,
      message: "",
      setMessage: vi.fn(),
      page: 1,
      setPage: vi.fn(),
      totalPages: 1,
      totalItems: 0,
      search: "",
      setSearch: vi.fn(),
      appliedSearch: "",
      setAppliedSearch: vi.fn(),
      sortBy: "title",
      setSortBy: vi.fn(),
      order: "asc",
      setOrder: vi.fn(),
      artistFilter: "",
      setArtistFilter: vi.fn(),
      albumFilter: "",
      setAlbumFilter: vi.fn(),
      extensionFilter: "",
      setExtensionFilter: vi.fn(),
      exactArtistFilter: "",
      exactAlbumFilter: "",
      loadTracks: vi.fn(),
      loadAllTracksForQueue: vi.fn(async () => []),
      clearAllFilters: vi.fn(),
      applyArtistClick: vi.fn(),
      applyAlbumClick: vi.fn(),
    };
  },
}));

vi.mock("../hooks/useLibraryViews", () => ({
  default: ({ source }) => {
    lastLibraryViewsSource = source;

    return {
      viewMode: "tracks",
      setViewMode: vi.fn(),
      artists: [],
      artistsLoading: false,
      albums: [],
      albumsLoading: false,
      loadArtists: vi.fn(),
      loadAlbums: vi.fn(),
    };
  },
}));

vi.mock("../context/PlayerContext", () => ({
  usePlayer: () => ({
    playQueue: vi.fn(),
  }),
}));

vi.mock("../utils/demoMode", () => ({
  isDemoMode: () => false,
}));

vi.mock("../components/ScanProgress", () => ({
  default: () => React.createElement("div", null, "ScanProgress"),
}));

vi.mock("../components/LibraryViewTabs", () => ({
  default: () => React.createElement("div", null, "LibraryViewTabs"),
}));

vi.mock("../components/ArtistList", () => ({
  default: () => React.createElement("div", null, "ArtistList"),
}));

vi.mock("../components/AlbumList", () => ({
  default: () => React.createElement("div", null, "AlbumList"),
}));

vi.mock("../components/TrackBrowser", () => ({
  default: ({ mode, emptyStateMessage }) =>
    React.createElement(
      "div",
      null,
      `TrackBrowser:${mode}:${emptyStateMessage}`,
    ),
}));

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAppMode = "lan";
    lastTrackBrowserSource = null;
    lastLibraryViewsSource = null;
  });

  it("uses the backend source and keeps scan actions visible in LAN mode", () => {
    currentAppMode = "lan";
    const markup = renderToStaticMarkup(React.createElement(LibraryPage));

    expect(markup).toContain("Library Scanner");
    expect(markup).toContain("Scan Library");
    expect(markup).toContain("Clear Library");
    expect(lastTrackBrowserSource).toBe(sourceMocks.backend);
    expect(lastLibraryViewsSource).toBe(sourceMocks.backend);
  });

  it("uses the offline source and hides scan actions in Offline Mode", () => {
    currentAppMode = "offline";
    const markup = renderToStaticMarkup(React.createElement(LibraryPage));

    expect(markup).toContain("Offline Library");
    expect(markup).toContain("Offline Mode");
    expect(markup).toContain("No downloaded tracks are available on this device yet.");
    expect(markup).not.toContain("Scan Library");
    expect(markup).not.toContain("Clear Library");
    expect(markup).toContain("TrackBrowser:offline");
    expect(lastTrackBrowserSource).toBe(sourceMocks.offline);
    expect(lastLibraryViewsSource).toBe(sourceMocks.offline);
  });

  it("switches between offline and LAN sources across rerenders without an app rebuild", () => {
    currentAppMode = "offline";
    let markup = renderToStaticMarkup(React.createElement(LibraryPage));

    expect(markup).toContain("Offline Library");
    expect(lastTrackBrowserSource).toBe(sourceMocks.offline);

    currentAppMode = "lan";
    markup = renderToStaticMarkup(React.createElement(LibraryPage));

    expect(markup).toContain("Library Scanner");
    expect(lastTrackBrowserSource).toBe(sourceMocks.backend);
    expect(lastLibraryViewsSource).toBe(sourceMocks.backend);
  });
});
