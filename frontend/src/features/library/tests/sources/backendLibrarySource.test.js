import { beforeEach, describe, expect, it, vi } from "vitest";

const libraryApiMocks = {
  getTracks: vi.fn(),
  getArtists: vi.fn(),
  getAlbums: vi.fn(),
};

vi.mock("../../../../api/libraryApi", () => libraryApiMocks);

async function loadModule() {
  return import("../../sources/backendLibrarySource.js");
}

describe("backendLibrarySource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    libraryApiMocks.getTracks.mockResolvedValue({
      items: [],
      total_items: 0,
      total_pages: 1,
    });
    libraryApiMocks.getArtists.mockResolvedValue([]);
    libraryApiMocks.getAlbums.mockResolvedValue([]);
  });

  it("delegates track reads to the backend library API", async () => {
    const { backendLibrarySource } = await loadModule();

    await backendLibrarySource.getTracks({
      page: 2,
      pageSize: 50,
      search: "test",
      sortBy: "artist",
      order: "desc",
      artist: "A",
      exactArtist: "Artist A",
      album: "B",
      exactAlbum: "Album B",
      extension: "mp3",
    });

    expect(libraryApiMocks.getTracks).toHaveBeenCalledWith(
      2,
      50,
      "test",
      "artist",
      "desc",
      "A",
      "Artist A",
      "B",
      "Album B",
      "mp3",
    );
  });

  it("delegates artist and album reads to the backend library API", async () => {
    const { backendLibrarySource } = await loadModule();

    await backendLibrarySource.getArtists();
    await backendLibrarySource.getAlbums();

    expect(libraryApiMocks.getArtists).toHaveBeenCalledTimes(1);
    expect(libraryApiMocks.getAlbums).toHaveBeenCalledTimes(1);
  });

  it("returns an empty one-page library without extra pagination calls", async () => {
    libraryApiMocks.getTracks.mockResolvedValueOnce({
      items: [],
      total_items: 0,
      total_pages: 1,
    });

    const { backendLibrarySource } = await loadModule();
    const result = await backendLibrarySource.getAllTracks();

    expect(libraryApiMocks.getTracks).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([]);
    expect(result.total_items).toBe(0);
    expect(result.total_pages).toBe(1);
  });

  it("returns a one-page library without fetching more pages", async () => {
    libraryApiMocks.getTracks.mockResolvedValueOnce({
      items: [{ id: "track-1", title: "Only Track" }],
      total_items: 1,
      total_pages: 1,
    });

    const { backendLibrarySource } = await loadModule();
    const result = await backendLibrarySource.getAllTracks();

    expect(libraryApiMocks.getTracks).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([{ id: "track-1", title: "Only Track" }]);
  });

  it("fetches all track pages through the existing backend track API", async () => {
    libraryApiMocks.getTracks
      .mockResolvedValueOnce({
        items: [{ id: "track-1", title: "One" }],
        total_items: 2,
        total_pages: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: "track-2", title: "Two" }],
        total_items: 2,
        total_pages: 2,
      });

    const { backendLibrarySource } = await loadModule();
    const result = await backendLibrarySource.getAllTracks({
      search: "road",
      sortBy: "title",
      order: "asc",
    });

    expect(libraryApiMocks.getTracks).toHaveBeenNthCalledWith(
      1,
      1,
      100,
      "road",
      "title",
      "asc",
      "",
      "",
      "",
      "",
      "",
    );
    expect(libraryApiMocks.getTracks).toHaveBeenNthCalledWith(
      2,
      2,
      100,
      "road",
      "title",
      "asc",
      "",
      "",
      "",
      "",
      "",
    );
    expect(result.items).toEqual([
      { id: "track-1", title: "One" },
      { id: "track-2", title: "Two" },
    ]);
    expect(result.total_items).toBe(2);
    expect(result.total_pages).toBe(2);
  });
});
