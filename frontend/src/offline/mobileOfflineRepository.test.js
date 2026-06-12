import { beforeEach, describe, expect, it, vi } from "vitest";

let nativeAndroidSupported = false;
let mobileDatabase = null;

const offlineStorageMocks = {
  clearOfflineDownloads: vi.fn(),
  deleteDownloadedPlaylist: vi.fn(),
  getDownloadedPlaylist: vi.fn(),
  getDownloadedPlaylists: vi.fn(),
  getDownloadedTrack: vi.fn(),
  getDownloadedTracks: vi.fn(),
  getOfflineStorageSummary: vi.fn(),
};

const nativeMediaStorageMocks = {
  clearNativeMediaFiles: vi.fn(),
  deleteAudioFile: vi.fn(),
  deleteArtworkFile: vi.fn(),
  getNativeMediaFileSize: vi.fn(),
  getPlayableNativeAudioUri: vi.fn(),
  getPlayableNativeArtworkUri: vi.fn(),
  nativeMediaFileExists: vi.fn(),
};

vi.mock("./offlineStorage", () => offlineStorageMocks);
vi.mock("./nativeMediaFileStorage", () => nativeMediaStorageMocks);

vi.mock("./mobileSqliteDb", () => ({
  getMobileOfflineDb: vi.fn(async () => mobileDatabase),
  initializeMobileOfflineDb: vi.fn(async () => Boolean(mobileDatabase)),
  isNativeAndroidMobileOfflineSupported: vi.fn(() => nativeAndroidSupported),
}));

async function loadRepository() {
  return import("./mobileOfflineRepository.js");
}

function createMockDatabase({ queryHandler } = {}) {
  return {
    beginTransaction: vi.fn().mockResolvedValue({}),
    commitTransaction: vi.fn().mockResolvedValue({}),
    rollbackTransaction: vi.fn().mockResolvedValue({}),
    run: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
    query: vi.fn(async (statement, values = []) => {
      if (queryHandler) {
        return queryHandler(statement, values);
      }

      return { values: [] };
    }),
  };
}

describe("mobileOfflineRepository", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    nativeAndroidSupported = false;
    mobileDatabase = null;

    offlineStorageMocks.clearOfflineDownloads.mockResolvedValue(true);
    offlineStorageMocks.deleteDownloadedPlaylist.mockResolvedValue(true);
    offlineStorageMocks.getDownloadedPlaylist.mockResolvedValue(null);
    offlineStorageMocks.getDownloadedPlaylists.mockResolvedValue([]);
    offlineStorageMocks.getDownloadedTrack.mockResolvedValue(null);
    offlineStorageMocks.getDownloadedTracks.mockResolvedValue([]);
    offlineStorageMocks.getOfflineStorageSummary.mockResolvedValue({
      available: true,
      playlistCount: 0,
      trackCount: 0,
      storageType: "indexeddb",
      audioBlobCount: 0,
      artworkBlobCount: 0,
      totalAudioBytes: 0,
      totalArtworkBytes: 0,
      missingAudioFileCount: 0,
      missingArtworkFileCount: 0,
      missingFileCount: 0,
      totalBytes: 0,
    });
    nativeMediaStorageMocks.clearNativeMediaFiles.mockResolvedValue({
      deletedAudioFiles: 0,
      deletedArtworkFiles: 0,
    });
    nativeMediaStorageMocks.deleteAudioFile.mockResolvedValue(false);
    nativeMediaStorageMocks.deleteArtworkFile.mockResolvedValue(false);
    nativeMediaStorageMocks.getNativeMediaFileSize.mockResolvedValue(0);
    nativeMediaStorageMocks.getPlayableNativeAudioUri.mockResolvedValue(null);
    nativeMediaStorageMocks.getPlayableNativeArtworkUri.mockResolvedValue(null);
    nativeMediaStorageMocks.nativeMediaFileExists.mockResolvedValue(false);
    global.fetch = vi.fn();
  });

  it("uses the SQLite path for playlist reads on native Android", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async () => ({
        values: [{ id: "p1", name: "Road Trip", totalTracks: 3 }],
      }),
    });

    const { getOfflinePlaylists } = await loadRepository();
    const playlists = await getOfflinePlaylists();

    expect(playlists).toEqual([
      expect.objectContaining({
        id: "p1",
        name: "Road Trip",
        totalTracks: 3,
      }),
    ]);
    expect(mobileDatabase.query).toHaveBeenCalledTimes(1);
    expect(offlineStorageMocks.getDownloadedPlaylists).not.toHaveBeenCalled();
  });

  it("builds the Android storage summary from verified native files without network calls", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement) => {
        if (statement.includes("COUNT(*) AS count FROM offline_playlists")) {
          return { values: [{ count: 2 }] };
        }

        if (statement.includes("FROM offline_tracks t")) {
          return {
            values: [
              {
                id: "track-1",
                audioLocalUri: "media/audio/track-1.mp3",
                artworkLocalUri: "media/artwork/track-1.jpg",
              },
              {
                id: "track-2",
                audioLocalUri: "media/audio/track-2.mp3",
                artworkLocalUri: "media/artwork/track-2.jpg",
              },
              {
                id: "track-3",
                audioLocalUri: null,
                artworkLocalUri: null,
              },
            ],
          };
        }

        if (statement.includes("SUM(CASE WHEN media_type = 'audio'")) {
          return {
            values: [{ audioCount: 2, artworkCount: 2 }],
          };
        }

        return { values: [] };
      },
    });
    nativeMediaStorageMocks.getNativeMediaFileSize.mockImplementation(async (relativePath) => {
      if (relativePath === "media/audio/track-1.mp3") {
        return 4096;
      }

      if (relativePath === "media/artwork/track-1.jpg") {
        return 512;
      }

      if (relativePath === "media/artwork/track-2.jpg") {
        return null;
      }

      if (relativePath === "media/audio/track-2.mp3") {
        return null;
      }

      return null;
    });

    const { getOfflineStorageSummary } = await loadRepository();
    const summary = await getOfflineStorageSummary();

    expect(summary).toEqual({
      available: true,
      playlistCount: 2,
      trackCount: 3,
      storageType: "native_file",
      audioBlobCount: 2,
      artworkBlobCount: 2,
      audioFileCount: 1,
      artworkFileCount: 1,
      totalAudioBytes: 4096,
      totalArtworkBytes: 512,
      missingAudioFileCount: 2,
      missingArtworkFileCount: 1,
      missingFileCount: 3,
      totalBytes: 4608,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses the IndexedDB fallback path in the browser", async () => {
    offlineStorageMocks.getDownloadedPlaylists.mockResolvedValue([
      { id: "browser-playlist", name: "Browser Fallback" },
    ]);

    const { getOfflinePlaylists } = await loadRepository();
    const playlists = await getOfflinePlaylists();

    expect(playlists).toEqual([
      { id: "browser-playlist", name: "Browser Fallback" },
    ]);
    expect(offlineStorageMocks.getDownloadedPlaylists).toHaveBeenCalledTimes(1);
  });

  it("uses the IndexedDB fallback summary in the browser", async () => {
    offlineStorageMocks.getOfflineStorageSummary.mockResolvedValue({
      available: true,
      playlistCount: 1,
      trackCount: 4,
      storageType: "indexeddb",
      audioBlobCount: 4,
      artworkBlobCount: 2,
      totalAudioBytes: 8192,
      totalArtworkBytes: 1024,
      missingAudioFileCount: 0,
      missingArtworkFileCount: 0,
      missingFileCount: 0,
      totalBytes: 9216,
    });

    const { getOfflineStorageSummary } = await loadRepository();
    const summary = await getOfflineStorageSummary();

    expect(summary).toEqual({
      available: true,
      playlistCount: 1,
      trackCount: 4,
      storageType: "indexeddb",
      audioBlobCount: 4,
      artworkBlobCount: 2,
      totalAudioBytes: 8192,
      totalArtworkBytes: 1024,
      missingAudioFileCount: 0,
      missingArtworkFileCount: 0,
      missingFileCount: 0,
      totalBytes: 9216,
    });
    expect(offlineStorageMocks.getOfflineStorageSummary).toHaveBeenCalledTimes(1);
  });

  it("builds playlist tracks from the IndexedDB fallback path in the browser", async () => {
    offlineStorageMocks.getDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      trackIds: ["track-2", "track-1"],
    });
    offlineStorageMocks.getDownloadedTracks.mockResolvedValue([
      { id: "track-1", title: "One" },
      { id: "track-2", title: "Two" },
    ]);

    const { getOfflineTracksForPlaylist } = await loadRepository();
    const tracks = await getOfflineTracksForPlaylist("playlist-1");

    expect(tracks).toEqual([
      expect.objectContaining({
        id: "track-2",
        title: "Two",
        trackOrder: 0,
        audioBlobId: null,
        artworkBlobId: null,
        storageType: "indexeddb_blob",
      }),
      expect.objectContaining({
        id: "track-1",
        title: "One",
        trackOrder: 1,
        audioBlobId: null,
        artworkBlobId: null,
        storageType: "indexeddb_blob",
      }),
    ]);
    expect(offlineStorageMocks.getDownloadedPlaylist).toHaveBeenCalledWith("playlist-1");
    expect(offlineStorageMocks.getDownloadedTracks).toHaveBeenCalledTimes(1);
  });

  it("rejects Windows drive paths for media refs", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { saveOfflineMediaFileRef } = await loadRepository();

    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "C:\\Music\\song.mp3"),
    ).resolves.toBeNull();
    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "S:\\Music\\song.mp3"),
    ).resolves.toBeNull();

    expect(mobileDatabase.beginTransaction).not.toHaveBeenCalled();
  });

  it("rejects UNC and traversal paths for media refs", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { saveOfflineMediaFileRef } = await loadRepository();

    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "\\\\DESKTOP\\Music\\song.mp3"),
    ).resolves.toBeNull();
    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "../media/audio/123.mp3"),
    ).resolves.toBeNull();
    await expect(
      saveOfflineMediaFileRef("track-1", "audio", "media/../audio/123.mp3"),
    ).resolves.toBeNull();

    expect(mobileDatabase.beginTransaction).not.toHaveBeenCalled();
  });

  it("accepts safe app-local media refs", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT * FROM offline_media_files")) {
          return {
            values: [
              {
                track_id: values[0],
                media_type: values[1],
                local_uri: "media/audio/123.mp3",
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { saveOfflineMediaFileRef } = await loadRepository();
    const result = await saveOfflineMediaFileRef(
      "track-1",
      "audio",
      "media/audio/123.mp3",
    );

    expect(result).toEqual(
      expect.objectContaining({
        trackId: "track-1",
        mediaType: "audio",
        localUri: "media/audio/123.mp3",
      }),
    );
    expect(mobileDatabase.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mobileDatabase.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it("writes offline track metadata to SQLite", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT * FROM offline_tracks")) {
          return {
            values: [
              {
                id: values[0],
                title: "Song A",
                download_status: "downloaded",
                file_path: "S:\\Music\\song-a.mp3",
                folder_path: "S:\\Music",
                art_path: "S:\\Music\\cover.jpg",
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { saveOfflineTrackMetadata } = await loadRepository();
    const track = await saveOfflineTrackMetadata({
      id: "track-1",
      title: "Song A",
      artist: "Artist A",
      album: "Album A",
      duration: 245,
      downloadStatus: "downloaded",
      file_path: "S:\\Music\\song-a.mp3",
      folder_path: "S:\\Music",
      art_path: "S:\\Music\\cover.jpg",
    });

    expect(track).toEqual(
      expect.objectContaining({
        id: "track-1",
        title: "Song A",
        downloadStatus: "downloaded",
      }),
    );
    expect(track).not.toHaveProperty("file_path");
    expect(track).not.toHaveProperty("folder_path");
    expect(track).not.toHaveProperty("art_path");
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO offline_tracks"),
      expect.arrayContaining(["track-1", "Song A", "Artist A", "Album A", 245]),
      false,
    );
    expect(mobileDatabase.run).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["S:\\Music\\song-a.mp3"]),
      false,
    );
    expect(mobileDatabase.run).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["S:\\Music"]),
      false,
    );
    expect(mobileDatabase.run).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["S:\\Music\\cover.jpg"]),
      false,
    );
  });

  it("writes offline playlist metadata to SQLite", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT * FROM offline_playlists")) {
          return {
            values: [
              {
                id: values[0],
                name: "Favorites",
                total_tracks: 12,
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { saveOfflinePlaylistMetadata } = await loadRepository();
    const playlist = await saveOfflinePlaylistMetadata({
      id: "playlist-1",
      name: "Favorites",
      totalTracks: 12,
      totalBytes: 1024,
      downloadStatus: "downloaded",
    });

    expect(playlist).toEqual(
      expect.objectContaining({
        id: "playlist-1",
        name: "Favorites",
      }),
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO offline_playlists"),
      expect.arrayContaining(["playlist-1", "Favorites", 12, 1024, "downloaded"]),
      false,
    );
  });

  it("returns only safe fields from native offline track reads", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement) => {
        if (statement.includes("FROM offline_playlist_tracks")) {
          return {
            values: [
              {
                id: "track-1",
                title: "Song A",
                artist: "Artist A",
                album: "Album A",
                duration: 245,
                downloadStatus: "downloaded",
                storageType: "native_file",
                downloadedAt: "2026-06-11T10:00:00.000Z",
                trackOrder: 0,
                audioLocalUri: "media/audio/123.mp3",
                artworkLocalUri: "S:\\Music\\cover.jpg",
                file_path: "S:\\Music\\song-a.mp3",
                folder_path: "S:\\Music",
                art_path: "S:\\Music\\cover.jpg",
              },
            ],
          };
        }

        return { values: [] };
      },
    });

    const { getOfflineTracksForPlaylist } = await loadRepository();
    const tracks = await getOfflineTracksForPlaylist("playlist-1");

    expect(tracks).toEqual([
      {
        id: "track-1",
        title: "Song A",
        artist: "Artist A",
        album: "Album A",
        duration: 245,
        downloadStatus: "downloaded",
        storageType: "native_file",
        downloadedAt: "2026-06-11T10:00:00.000Z",
        updatedAt: null,
        trackOrder: 0,
        audioLocalUri: "media/audio/123.mp3",
        artworkLocalUri: null,
      },
    ]);
    expect(tracks[0]).not.toHaveProperty("file_path");
    expect(tracks[0]).not.toHaveProperty("folder_path");
    expect(tracks[0]).not.toHaveProperty("art_path");
  });

  it("inspects native playlist downloads using SQLite refs plus native file checks", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("FROM offline_playlists")) {
          return {
            values: [
              {
                id: "playlist-1",
                name: "Road Trip",
                totalTracks: 2,
                totalBytes: 3072,
                downloadedAt: "2026-06-11T10:00:00.000Z",
              },
            ],
          };
        }

        if (statement.includes("FROM offline_playlist_tracks")) {
          return {
            values: [
              {
                id: "track-1",
                title: "Song A",
                artist: "Artist A",
                album: "Album A",
                duration: 245,
                downloadStatus: "downloaded",
                storageType: "native_file",
                downloadedAt: "2026-06-11T10:00:00.000Z",
                trackOrder: 0,
                audioLocalUri: "media/audio/track-1.mp3",
                artworkLocalUri: "media/artwork/track-1.jpg",
              },
              {
                id: "track-2",
                title: "Song B",
                artist: "Artist B",
                album: "Album B",
                duration: 210,
                downloadStatus: "downloaded",
                storageType: "native_file",
                downloadedAt: "2026-06-11T10:00:00.000Z",
                trackOrder: 1,
                audioLocalUri: "media/audio/track-2.mp3",
                artworkLocalUri: null,
              },
            ],
          };
        }

        return { values: [] };
      },
    });
    nativeMediaStorageMocks.nativeMediaFileExists.mockImplementation(async (relativePath) =>
      relativePath !== "media/audio/track-2.mp3",
    );
    nativeMediaStorageMocks.getNativeMediaFileSize.mockImplementation(async (relativePath) => {
      if (relativePath === "media/audio/track-1.mp3") {
        return 2048;
      }

      if (relativePath === "media/artwork/track-1.jpg") {
        return 512;
      }

      return null;
    });

    const {
      inspectDownloadedPlaylist,
      inspectNativeMediaFilesForPlaylist,
    } = await loadRepository();
    const mediaInspection = await inspectNativeMediaFilesForPlaylist("playlist-1");
    const inspection = await inspectDownloadedPlaylist("playlist-1");

    expect(mediaInspection).toEqual(
      expect.objectContaining({
        playlistId: "playlist-1",
        trackCount: 2,
        sqliteAudioMediaRefCount: 2,
        sqliteArtworkMediaRefCount: 1,
        nativeAudioFileCount: 1,
        missingNativeAudioFileCount: 1,
        nativeArtworkFileCount: 1,
        missingNativeArtworkFileCount: 0,
      }),
    );
    expect(inspection).toEqual(
      expect.objectContaining({
        playlistId: "playlist-1",
        playlistName: "Road Trip",
        trackCount: 2,
        sqliteTrackRowCount: 2,
        sqliteAudioMediaRefCount: 2,
        sqliteArtworkMediaRefCount: 1,
        nativeAudioFileCount: 1,
        missingNativeAudioFileCount: 1,
        nativeArtworkFileCount: 1,
        missingNativeArtworkFileCount: 0,
      }),
    );
    expect(inspection.audioFiles).toEqual([
      {
        trackId: "track-1",
        relativePath: "media/audio/track-1.mp3",
        exists: true,
        sizeBytes: 2048,
      },
      {
        trackId: "track-2",
        relativePath: "media/audio/track-2.mp3",
        exists: false,
        sizeBytes: 0,
      },
    ]);
    expect(inspection.artworkFiles).toEqual([
      {
        trackId: "track-1",
        relativePath: "media/artwork/track-1.jpg",
        exists: true,
        sizeBytes: 512,
      },
    ]);
  });

  it("builds an Android offline playback queue with native file URIs and preserves order", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement) => {
        if (statement.includes("FROM offline_playlists")) {
          return {
            values: [
              {
                id: "playlist-1",
                name: "Road Trip",
                totalTracks: 2,
              },
            ],
          };
        }

        if (statement.includes("FROM offline_playlist_tracks")) {
          return {
            values: [
              {
                id: "track-2",
                title: "Second",
                artist: "Artist B",
                album: "Album B",
                duration: 222,
                storageType: "native_file",
                trackOrder: 0,
                audioLocalUri: "media/audio/track-2.mp3",
                artworkLocalUri: null,
              },
              {
                id: "track-1",
                title: "First",
                artist: "Artist A",
                album: "Album A",
                duration: 111,
                storageType: "native_file",
                trackOrder: 1,
                audioLocalUri: "media/audio/track-1.mp3",
                artworkLocalUri: "media/artwork/track-1.jpg",
              },
            ],
          };
        }

        return { values: [] };
      },
    });
    nativeMediaStorageMocks.getPlayableNativeAudioUri.mockImplementation(async (relativePath) =>
      `http://localhost/_capacitor_file_/${relativePath}`,
    );
    nativeMediaStorageMocks.getPlayableNativeArtworkUri.mockResolvedValue(
      "http://localhost/_capacitor_file_/media/artwork/track-1.jpg",
    );

    const { buildOfflinePlaybackQueue } = await loadRepository();
    const queue = await buildOfflinePlaybackQueue("playlist-1");

    expect(queue).toEqual({
      playlistId: "playlist-1",
      playlistName: "Road Trip",
      totalTracks: 2,
      missingTrackIds: [],
      tracks: [
        {
          id: "track-2",
          title: "Second",
          artist: "Artist B",
          album: "Album B",
          duration: 222,
          offline: true,
          storageType: "native_file",
          audioSrc: "http://localhost/_capacitor_file_/media/audio/track-2.mp3",
          artworkSrc: null,
          audioBlobId: null,
          artworkBlobId: null,
        },
        {
          id: "track-1",
          title: "First",
          artist: "Artist A",
          album: "Album A",
          duration: 111,
          offline: true,
          storageType: "native_file",
          audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
          artworkSrc: "http://localhost/_capacitor_file_/media/artwork/track-1.jpg",
          audioBlobId: null,
          artworkBlobId: null,
        },
      ],
    });
    expect(queue?.tracks.every((track) => !track.audioSrc?.startsWith("file://"))).toBe(true);
  });

  it("rebuilds the Android offline playback queue from SQLite/native refs after a module reload", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement) => {
        if (statement.includes("FROM offline_playlists")) {
          return {
            values: [
              {
                id: "playlist-1",
                name: "Recovered Offline Playlist",
                totalTracks: 1,
              },
            ],
          };
        }

        if (statement.includes("FROM offline_playlist_tracks")) {
          return {
            values: [
              {
                id: "track-1",
                title: "Recovered Track",
                artist: "Artist A",
                album: "Album A",
                duration: 180,
                storageType: "native_file",
                trackOrder: 0,
                audioLocalUri: "media/audio/track-1.mp3",
                artworkLocalUri: null,
              },
            ],
          };
        }

        return { values: [] };
      },
    });
    nativeMediaStorageMocks.getPlayableNativeAudioUri.mockResolvedValue(
      "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
    );

    let repository = await loadRepository();
    let queue = await repository.buildOfflinePlaybackQueue("playlist-1");

    expect(queue?.tracks).toEqual([
      expect.objectContaining({
        id: "track-1",
        audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
      }),
    ]);

    vi.resetModules();
    repository = await loadRepository();
    queue = await repository.buildOfflinePlaybackQueue("playlist-1");

    expect(queue).toEqual({
      playlistId: "playlist-1",
      playlistName: "Recovered Offline Playlist",
      totalTracks: 1,
      missingTrackIds: [],
      tracks: [
        {
          id: "track-1",
          title: "Recovered Track",
          artist: "Artist A",
          album: "Album A",
          duration: 180,
          offline: true,
          storageType: "native_file",
          audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
          artworkSrc: null,
          audioBlobId: null,
          artworkBlobId: null,
        },
      ],
    });
  });

  it("skips Android offline tracks with missing native audio files", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement) => {
        if (statement.includes("FROM offline_playlists")) {
          return {
            values: [{ id: "playlist-1", name: "Road Trip", totalTracks: 2 }],
          };
        }

        if (statement.includes("FROM offline_playlist_tracks")) {
          return {
            values: [
              {
                id: "track-1",
                title: "Playable",
                audioLocalUri: "media/audio/track-1.mp3",
              },
              {
                id: "track-2",
                title: "Missing",
                audioLocalUri: "media/audio/track-2.mp3",
              },
            ],
          };
        }

        return { values: [] };
      },
    });
    nativeMediaStorageMocks.getPlayableNativeAudioUri.mockImplementation(async (relativePath) =>
      relativePath === "media/audio/track-1.mp3"
        ? "http://localhost/_capacitor_file_/media/audio/track-1.mp3"
        : null,
    );

    const { buildOfflinePlaybackQueue } = await loadRepository();
    const queue = await buildOfflinePlaybackQueue("playlist-1");

    expect(queue?.tracks).toEqual([
      expect.objectContaining({
        id: "track-1",
        audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
      }),
    ]);
    expect(queue?.missingTrackIds).toEqual(["track-2"]);
  });

  it("builds a browser offline playback queue without raw PC paths", async () => {
    offlineStorageMocks.getDownloadedPlaylists.mockResolvedValue([
      {
        id: "playlist-1",
        name: "Browser Playlist",
      },
    ]);
    offlineStorageMocks.getDownloadedPlaylist.mockResolvedValue({
      id: "playlist-1",
      trackIds: ["track-2", "track-1"],
    });
    offlineStorageMocks.getDownloadedTracks.mockResolvedValue([
      {
        id: "track-1",
        title: "One",
        artist: "Artist A",
        album: "Album A",
        duration: 111,
        audioBlobId: "track:track-1:audio",
        artworkBlobId: "track:track-1:artwork",
        file_path: "S:\\Music\\one.mp3",
      },
      {
        id: "track-2",
        title: "Two",
        artist: "Artist B",
        album: "Album B",
        duration: 222,
        audioBlobId: "track:track-2:audio",
        artworkBlobId: null,
        folder_path: "S:\\Music",
      },
    ]);

    const { buildOfflinePlaybackQueue } = await loadRepository();
    const queue = await buildOfflinePlaybackQueue("playlist-1");

    expect(queue).toEqual({
      playlistId: "playlist-1",
      playlistName: "Browser Playlist",
      totalTracks: 2,
      missingTrackIds: [],
      tracks: [
        {
          id: "track-2",
          title: "Two",
          artist: "Artist B",
          album: "Album B",
          duration: 222,
          offline: true,
          storageType: "indexeddb_blob",
          audioSrc: null,
          artworkSrc: null,
          audioBlobId: "track:track-2:audio",
          artworkBlobId: null,
        },
        {
          id: "track-1",
          title: "One",
          artist: "Artist A",
          album: "Album A",
          duration: 111,
          offline: true,
          storageType: "indexeddb_blob",
          audioSrc: null,
          artworkSrc: null,
          audioBlobId: "track:track-1:audio",
          artworkBlobId: "track:track-1:artwork",
        },
      ],
    });
    expect(queue?.tracks[0]).not.toHaveProperty("file_path");
    expect(queue?.tracks[1]).not.toHaveProperty("folder_path");
  });

  it("saves playlist track order to SQLite", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { saveOfflinePlaylistTracks } = await loadRepository();
    const result = await saveOfflinePlaylistTracks("playlist-1", [
      "track-3",
      "track-1",
      "track-2",
    ]);

    expect(result).toBe(true);
    expect(mobileDatabase.run).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
      ["playlist-1"],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO offline_playlist_tracks"),
      ["playlist-1", "track-3", 0, expect.any(String)],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO offline_playlist_tracks"),
      ["playlist-1", "track-2", 2, expect.any(String)],
      false,
    );
  });

  it("deletes only the removed playlist membership and preserves shared tracks", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase({
      queryHandler: async (statement, values) => {
        if (statement.includes("SELECT track_id AS trackId FROM offline_playlist_tracks")) {
          return { values: [{ trackId: "track-shared" }, { trackId: "track-exclusive" }] };
        }

        if (statement.includes("SELECT COUNT(*) AS count FROM offline_playlist_tracks")) {
          if (values[0] === "track-shared") {
            return { values: [{ count: 1 }] };
          }

          if (values[0] === "track-exclusive") {
            return { values: [{ count: 0 }] };
          }
        }

        return { values: [] };
      },
    });

    const { deleteOfflinePlaylist } = await loadRepository();
    const result = await deleteOfflinePlaylist("playlist-1");

    expect(result).toBe(true);
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_playlists WHERE id = ?",
      ["playlist-1"],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_media_files WHERE track_id = ?",
      ["track-exclusive"],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_tracks WHERE id = ?",
      ["track-exclusive"],
      false,
    );
    expect(mobileDatabase.run).not.toHaveBeenCalledWith(
      "DELETE FROM offline_tracks WHERE id = ?",
      ["track-shared"],
      false,
    );
    expect(nativeMediaStorageMocks.deleteAudioFile).toHaveBeenCalledWith(
      "track-exclusive",
    );
    expect(nativeMediaStorageMocks.deleteArtworkFile).toHaveBeenCalledWith(
      "track-exclusive",
    );
    expect(nativeMediaStorageMocks.deleteAudioFile).not.toHaveBeenCalledWith(
      "track-shared",
    );
  });

  it("clears all mobile offline tables on native Android", async () => {
    nativeAndroidSupported = true;
    mobileDatabase = createMockDatabase();

    const { clearMobileOfflineData } = await loadRepository();
    const result = await clearMobileOfflineData();

    expect(result).toBe(true);
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_media_files",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_playlist_tracks",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_downloads",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_tracks",
      [],
      false,
    );
    expect(mobileDatabase.run).toHaveBeenCalledWith(
      "DELETE FROM offline_playlists",
      [],
      false,
    );
    expect(nativeMediaStorageMocks.clearNativeMediaFiles).toHaveBeenCalledTimes(1);
  });

  it("uses IndexedDB fallbacks for delete and clear in the browser", async () => {
    const { deleteOfflinePlaylist, clearMobileOfflineData } = await loadRepository();

    await expect(deleteOfflinePlaylist("playlist-1")).resolves.toBe(true);
    await expect(clearMobileOfflineData()).resolves.toBe(true);

    expect(offlineStorageMocks.deleteDownloadedPlaylist).toHaveBeenCalledWith(
      "playlist-1",
    );
    expect(offlineStorageMocks.clearOfflineDownloads).toHaveBeenCalledTimes(1);
  });
});
