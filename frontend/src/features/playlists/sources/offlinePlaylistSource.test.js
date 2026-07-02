import { beforeEach, describe, expect, it, vi } from "vitest";

const mobileRepositoryMocks = {
  buildOfflinePlaybackQueue: vi.fn(),
  getOfflinePlaylistForPlayback: vi.fn(),
  getOfflinePlaylists: vi.fn(),
};

const playlistApiMocks = {
  createPlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  generateAiPlaylist: vi.fn(),
  getPlaylistDetail: vi.fn(),
  getPlaylists: vi.fn(),
  removeTrackFromPlaylist: vi.fn(),
  renamePlaylist: vi.fn(),
};

vi.mock("../offline/mobileOfflineRepository", () => mobileRepositoryMocks);
vi.mock("../api/playlistApi", () => playlistApiMocks);

async function loadModule() {
  return import("./offlinePlaylistSource.js");
}

describe("offlinePlaylistSource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mobileRepositoryMocks.getOfflinePlaylists.mockResolvedValue([
      {
        id: "playlist-1",
        name: "Road Trip",
        totalTracks: 2,
        totalBytes: 2048,
        downloadedAt: "2026-06-15T10:00:00.000Z",
        storageType: "native_file",
      },
    ]);
    mobileRepositoryMocks.getOfflinePlaylistForPlayback.mockResolvedValue({
      playlist: {
        id: "playlist-1",
        name: "Road Trip",
        totalTracks: 2,
        totalBytes: 2048,
        downloadedAt: "2026-06-15T10:00:00.000Z",
        storageType: "native_file",
      },
      tracks: [
        {
          id: "track-1",
          title: "Drive",
          artist: "Artist A",
          album: "Album A",
          duration: 180,
          trackOrder: 0,
          storageType: "native_file",
          audioLocalUri: "media/audio/track-1.mp3",
          artworkLocalUri: "media/artwork/track-1.jpg",
          file_path: "S:\\Music\\drive.mp3",
        },
        {
          id: "track-2",
          title: "Night",
          artist: "Artist B",
          album: "Album B",
          duration: 210,
          trackOrder: 1,
          storageType: "indexeddb_blob",
          audioBlobId: "track:track-2:audio",
          artworkBlobId: "track:track-2:artwork",
          folder_path: "S:\\Music",
          art_path: "\\\\DESKTOP\\Music\\cover.jpg",
        },
      ],
    });
    mobileRepositoryMocks.buildOfflinePlaybackQueue.mockResolvedValue({
      playlistId: "playlist-1",
      playlistName: "Road Trip",
      totalTracks: 2,
      missingTrackIds: ["track-2"],
      tracks: [
        {
          id: "track-1",
          track_id: "track-1",
          title: "Drive",
          offline: true,
          audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
        },
      ],
    });
  });

  it("reads offline playlists from local storage without calling backend playlist routes", async () => {
    const { offlinePlaylistSource } = await loadModule();
    const playlists = await offlinePlaylistSource.getPlaylists();

    expect(playlists).toEqual([
      {
        id: "playlist-1",
        name: "Road Trip",
        updated_at: "2026-06-15T10:00:00.000Z",
        updatedAt: "2026-06-15T10:00:00.000Z",
        downloadedAt: "2026-06-15T10:00:00.000Z",
        totalTracks: 2,
        totalBytes: 2048,
        storageType: "native_file",
        offline: true,
      },
    ]);
    expect(mobileRepositoryMocks.getOfflinePlaylists).toHaveBeenCalledTimes(1);
    expect(playlistApiMocks.getPlaylists).not.toHaveBeenCalled();
  });

  it("builds a safe offline playlist detail without leaking PC paths", async () => {
    const { offlinePlaylistSource } = await loadModule();
    const playlist = await offlinePlaylistSource.getPlaylistDetail("playlist-1");

    expect(playlist).toEqual({
      id: "playlist-1",
      name: "Road Trip",
      updated_at: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-06-15T10:00:00.000Z",
      downloadedAt: "2026-06-15T10:00:00.000Z",
      totalTracks: 2,
      totalBytes: 2048,
      storageType: "native_file",
      offline: true,
      tracks: [
        {
          id: "track-1",
          track_id: "track-1",
          playlist_track_id: "offline:playlist-1:track-1",
          position: 1,
          title: "Drive",
          artist: "Artist A",
          album: "Album A",
          duration: 180,
          file_name: "track-1.mp3",
          storageType: "native_file",
          downloadStatus: "downloaded",
          offline: true,
          audioSrc: null,
          artworkSrc: null,
          audioLocalUri: "media/audio/track-1.mp3",
          artworkLocalUri: "media/artwork/track-1.jpg",
          audioBlobId: null,
          artworkBlobId: null,
        },
        {
          id: "track-2",
          track_id: "track-2",
          playlist_track_id: "offline:playlist-1:track-2",
          position: 2,
          title: "Night",
          artist: "Artist B",
          album: "Album B",
          duration: 210,
          file_name: "offline-track-2",
          storageType: "indexeddb_blob",
          downloadStatus: "downloaded",
          offline: true,
          audioSrc: null,
          artworkSrc: null,
          audioLocalUri: null,
          artworkLocalUri: null,
          audioBlobId: "track:track-2:audio",
          artworkBlobId: "track:track-2:artwork",
        },
      ],
    });
    expect(playlist.tracks[0]).not.toHaveProperty("file_path");
    expect(playlist.tracks[1]).not.toHaveProperty("folder_path");
    expect(playlist.tracks[1]).not.toHaveProperty("art_path");
    expect(playlistApiMocks.getPlaylistDetail).not.toHaveBeenCalled();
  });

  it("strips unsafe local URIs, backend URLs, and extra sensitive fields from offline playlist tracks", async () => {
    mobileRepositoryMocks.getOfflinePlaylistForPlayback.mockResolvedValueOnce({
      playlist: {
        id: "playlist-2",
        name: "Unsafe Inputs",
        totalTracks: 1,
        totalBytes: 1024,
        downloadedAt: "2026-06-15T10:00:00.000Z",
        storageType: "native_file",
      },
      tracks: [
        {
          id: "track-unsafe",
          title: "Unsafe Track",
          artist: "Artist C",
          album: "Album C",
          duration: 150,
          trackOrder: 0,
          storageType: "native_file",
          audioLocalUri: "file:///data/user/0/com.harish.smartmusicorganizer/files/media/audio/track-unsafe.mp3",
          artworkLocalUri: "http://192.168.68.112:8000/tracks/track-unsafe/art",
          audioSrc: "http://192.168.68.112:8000/tracks/track-unsafe/stream",
          artworkSrc: "file:///data/user/0/private/cover.jpg",
          file_path: "C:\\Users\\Harish\\Music\\unsafe.mp3",
          folder_path: "\\\\DESKTOP\\Music",
          art_path: "S:\\Music\\cover.jpg",
          api_token: "secret-token",
          backendUrl: "http://192.168.68.112:8000",
          headers: {
            Authorization: "Bearer secret-token",
          },
        },
      ],
    });

    const { offlinePlaylistSource } = await loadModule();
    const playlist = await offlinePlaylistSource.getPlaylistDetail("playlist-2");

    expect(playlist).toEqual({
      id: "playlist-2",
      name: "Unsafe Inputs",
      updated_at: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-06-15T10:00:00.000Z",
      downloadedAt: "2026-06-15T10:00:00.000Z",
      totalTracks: 1,
      totalBytes: 1024,
      storageType: "native_file",
      offline: true,
      tracks: [
        {
          id: "track-unsafe",
          track_id: "track-unsafe",
          playlist_track_id: "offline:playlist-2:track-unsafe",
          position: 1,
          title: "Unsafe Track",
          artist: "Artist C",
          album: "Album C",
          duration: 150,
          file_name: "offline-track-unsafe",
          storageType: "native_file",
          downloadStatus: "downloaded",
          offline: true,
          audioSrc: null,
          artworkSrc: null,
          audioLocalUri: null,
          artworkLocalUri: null,
          audioBlobId: null,
          artworkBlobId: null,
        },
      ],
    });
    expect(playlist.tracks[0]).not.toHaveProperty("file_path");
    expect(playlist.tracks[0]).not.toHaveProperty("folder_path");
    expect(playlist.tracks[0]).not.toHaveProperty("art_path");
    expect(playlist.tracks[0]).not.toHaveProperty("api_token");
    expect(playlist.tracks[0]).not.toHaveProperty("backendUrl");
    expect(playlist.tracks[0]).not.toHaveProperty("headers");
  });

  it("builds offline playback queues locally without calling backend playlist routes", async () => {
    const { offlinePlaylistSource } = await loadModule();
    const queue = await offlinePlaylistSource.buildPlaybackQueue("playlist-1");

    expect(queue).toEqual({
      playlistId: "playlist-1",
      playlistName: "Road Trip",
      totalTracks: 2,
      missingTrackIds: ["track-2"],
      tracks: [
        {
          id: "track-1",
          track_id: "track-1",
          title: "Drive",
          offline: true,
          audioSrc: "http://localhost/_capacitor_file_/media/audio/track-1.mp3",
        },
      ],
    });
    expect(mobileRepositoryMocks.buildOfflinePlaybackQueue).toHaveBeenCalledWith(
      "playlist-1",
    );
    expect(playlistApiMocks.getPlaylistDetail).not.toHaveBeenCalled();
    expect(playlistApiMocks.getPlaylists).not.toHaveBeenCalled();
  });
});
