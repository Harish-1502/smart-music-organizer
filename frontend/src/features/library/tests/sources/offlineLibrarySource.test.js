import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = {
  getOfflineLibraryTracks: vi.fn(),
};

const libraryApiMocks = {
  getTracks: vi.fn(),
  getArtists: vi.fn(),
  getAlbums: vi.fn(),
};

vi.mock("../../../offline/storage/mobileOfflineRepository", () => repositoryMocks);
vi.mock("../../../../api/libraryApi", () => libraryApiMocks);

async function loadModule() {
  return import("../../sources/offlineLibrarySource.js");
}

describe("offlineLibrarySource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    repositoryMocks.getOfflineLibraryTracks.mockResolvedValue([
      {
        id: "track-2",
        title: "Second Song",
        artist: "",
        album: "Night Drive",
        duration: 125,
        storageType: "native_file",
        audioLocalUri: "media/audio/track-2.mp3",
        artworkLocalUri: "media/artwork/track-2.jpg",
        file_path: "S:\\Music\\Second Song.mp3",
      },
      {
        id: "track-1",
        title: "First Song",
        artist: "Artist A",
        album: "",
        duration: 245,
        storageType: "indexeddb_blob",
        audioBlobId: "track:track-1:audio",
        artworkBlobId: "track:track-1:artwork",
        folder_path: "C:\\Users\\Harish\\Music",
        art_path: "\\\\DESKTOP\\Music\\cover.jpg",
      },
    ]);
  });

  it("returns safe offline track objects without raw PC paths", async () => {
    const { offlineLibrarySource } = await loadModule();
    const result = await offlineLibrarySource.getTracks({
      page: 1,
      pageSize: 25,
      sortBy: "title",
      order: "asc",
    });

    expect(result.total_items).toBe(2);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "track-1",
        offline: true,
        storageType: "indexeddb_blob",
        file_name: "offline-track-1",
        audioBlobId: "track:track-1:audio",
        artworkBlobId: "track:track-1:artwork",
      }),
      expect.objectContaining({
        id: "track-2",
        offline: true,
        storageType: "native_file",
        file_name: "track-2.mp3",
        audioLocalUri: "media/audio/track-2.mp3",
        artworkLocalUri: "media/artwork/track-2.jpg",
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty("file_path");
    expect(result.items[0]).not.toHaveProperty("folder_path");
    expect(result.items[1]).not.toHaveProperty("art_path");
    expect(libraryApiMocks.getTracks).not.toHaveBeenCalled();
    expect(libraryApiMocks.getArtists).not.toHaveBeenCalled();
    expect(libraryApiMocks.getAlbums).not.toHaveBeenCalled();
  });

  it("builds offline artist and album views locally without backend calls", async () => {
    const { offlineLibrarySource } = await loadModule();
    const [artists, albums] = await Promise.all([
      offlineLibrarySource.getArtists(),
      offlineLibrarySource.getAlbums(),
    ]);

    expect(artists).toEqual([
      { artist: "Artist A", track_count: 1 },
      { artist: "Unknown Artist", track_count: 1 },
    ]);
    expect(albums).toEqual([
      { album: "Night Drive", artist: "Unknown Artist", track_count: 1 },
      { album: "Unknown Album", artist: "Artist A", track_count: 1 },
    ]);
    expect(repositoryMocks.getOfflineLibraryTracks).toHaveBeenCalledTimes(2);
  });

  it("keeps offline search, sort, and extension filtering working from local data", async () => {
    const { offlineLibrarySource } = await loadModule();
    const sortedResult = await offlineLibrarySource.getTracks({
      page: 1,
      pageSize: 10,
      search: "song",
      sortBy: "duration",
      order: "desc",
    });
    const extensionFilteredResult = await offlineLibrarySource.getTracks({
      page: 1,
      pageSize: 10,
      extension: "mp3",
    });

    expect(sortedResult.items.map((track) => track.id)).toEqual(["track-1", "track-2"]);
    expect(sortedResult.items[0].duration).toBeGreaterThan(
      sortedResult.items[1].duration,
    );
    expect(extensionFilteredResult.items.map((track) => track.id)).toEqual(["track-2"]);
    expect(
      extensionFilteredResult.items.every((track) => track.file_name.endsWith(".mp3")),
    ).toBe(true);
  });
});
