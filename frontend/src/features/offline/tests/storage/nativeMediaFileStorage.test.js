import { beforeEach, describe, expect, it, vi } from "vitest";

let isNativePlatform = false;
let currentPlatform = "web";

const filesystemMocks = {
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  readdir: vi.fn(),
  getUri: vi.fn(),
  stat: vi.fn(),
  deleteFile: vi.fn(),
};

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform,
    getPlatform: () => currentPlatform,
    convertFileSrc: (value) =>
      typeof value === "string" && value.startsWith("file://")
        ? value.replace("file://", "http://localhost/_capacitor_file_/")
        : typeof value === "string" && value.startsWith("content://")
          ? value.replace("content://", "http://localhost/_capacitor_content_/")
          : value,
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: {
    Data: "DATA",
  },
  Filesystem: filesystemMocks,
}));

async function loadModule() {
  return import("../../storage/nativeMediaFileStorage.js");
}

describe("nativeMediaFileStorage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    isNativePlatform = false;
    currentPlatform = "web";

    filesystemMocks.mkdir.mockResolvedValue(undefined);
    filesystemMocks.writeFile.mockResolvedValue({ uri: "file:///app/media/audio/track-1.mp3" });
    filesystemMocks.appendFile.mockResolvedValue(undefined);
    filesystemMocks.readdir.mockResolvedValue({ files: [] });
    filesystemMocks.getUri.mockResolvedValue({ uri: "file:///app/media/audio/track-1.mp3" });
    filesystemMocks.stat.mockResolvedValue({
      type: "file",
      size: 42,
      uri: "file:///app/media/audio/track-1.mp3",
    });
    filesystemMocks.deleteFile.mockResolvedValue(undefined);
  });

  it("supports native media storage only on Android", async () => {
    const { isNativeMediaFileStorageSupported } = await loadModule();

    expect(isNativeMediaFileStorageSupported()).toBe(false);

    isNativePlatform = true;
    currentPlatform = "ios";
    expect(isNativeMediaFileStorageSupported()).toBe(false);

    currentPlatform = "android";
    expect(isNativeMediaFileStorageSupported()).toBe(true);
  });

  it("throws a controlled unsupported error in the browser", async () => {
    const {
      NativeMediaStorageUnsupportedError,
      initializeNativeMediaStorage,
      saveAudioFile,
      getAudioFileUri,
      deleteAudioFile,
      clearNativeMediaFiles,
    } = await loadModule();

    await expect(initializeNativeMediaStorage()).rejects.toBeInstanceOf(
      NativeMediaStorageUnsupportedError,
    );
    await expect(
      saveAudioFile("track-1", new Blob(["x"]), "audio/mpeg"),
    ).rejects.toBeInstanceOf(NativeMediaStorageUnsupportedError);
    await expect(getAudioFileUri("track-1")).rejects.toBeInstanceOf(
      NativeMediaStorageUnsupportedError,
    );
    await expect(deleteAudioFile("track-1")).rejects.toBeInstanceOf(
      NativeMediaStorageUnsupportedError,
    );
    await expect(clearNativeMediaFiles()).rejects.toBeInstanceOf(
      NativeMediaStorageUnsupportedError,
    );
  });

  it("initializes app-owned audio and artwork directories on Android", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const {
      initializeNativeMediaStorage,
      NATIVE_MEDIA_AUDIO_DIR,
      NATIVE_MEDIA_ARTWORK_DIR,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
    } = await loadModule();

    await expect(initializeNativeMediaStorage()).resolves.toBe(true);

    expect(filesystemMocks.mkdir).toHaveBeenCalledWith({
      path: NATIVE_MEDIA_AUDIO_DIR,
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
      recursive: true,
    });
    expect(filesystemMocks.mkdir).toHaveBeenCalledWith({
      path: NATIVE_MEDIA_ARTWORK_DIR,
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
      recursive: true,
    });
  });

  it("ignores already-exists mkdir errors during initialization", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.mkdir.mockRejectedValueOnce(new Error("Directory already exists"));
    filesystemMocks.mkdir.mockResolvedValueOnce(undefined);

    const { initializeNativeMediaStorage } = await loadModule();

    await expect(initializeNativeMediaStorage()).resolves.toBe(true);
  });

  it("writes audio files under a safe generated app-owned path", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const {
      saveAudioFile,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
    } = await loadModule();

    const result = await saveAudioFile(
      "track_123",
      new Blob(["audio-bytes"], { type: "audio/mpeg" }),
      "audio/mpeg",
    );

    expect(filesystemMocks.writeFile).toHaveBeenCalledWith({
      path: "media/audio/track_123.mp3",
      data: "YXVkaW8tYnl0ZXM=",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
      recursive: true,
    });
    expect(filesystemMocks.appendFile).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        relativePath: "media/audio/track_123.mp3",
        storageType: "native_file",
        mimeType: "audio/mpeg",
      }),
    );
  });

  it("writes artwork files under a safe generated app-owned path", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const { saveArtworkFile } = await loadModule();

    const result = await saveArtworkFile(
      "cover-55",
      new Blob(["image-bytes"], { type: "image/jpeg" }),
      "image/jpeg",
    );

    expect(filesystemMocks.writeFile).toHaveBeenCalledWith({
      path: "media/artwork/cover-55.jpg",
      data: expect.any(String),
      directory: "DATA",
      recursive: true,
    });
    expect(result.relativePath).toBe("media/artwork/cover-55.jpg");
  });

  it("replaces older same-track audio file variants before writing a fresh file", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.readdir.mockResolvedValue({
      files: [
        {
          name: "track-1.bin",
          type: "file",
          size: 10,
          mtime: 1,
          uri: "file:///app/media/audio/track-1.bin",
        },
        {
          name: "track-1.mp3",
          type: "file",
          size: 20,
          mtime: 2,
          uri: "file:///app/media/audio/track-1.mp3",
        },
      ],
    });

    const { saveAudioFile } = await loadModule();
    await saveAudioFile(
      "track-1",
      new Blob(["fresh-audio"], { type: "audio/mpeg" }),
      "audio/mpeg",
    );

    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: "media/audio/track-1.bin",
      directory: "DATA",
    });
    expect(filesystemMocks.deleteFile).not.toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      directory: "DATA",
    });
    expect(filesystemMocks.writeFile).toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      data: expect.any(String),
      directory: "DATA",
      recursive: true,
    });
  });

  it("writes large audio files in smaller chunks to avoid giant bridge payloads", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const {
      saveAudioFile,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
      NATIVE_MEDIA_WRITE_CHUNK_BYTES,
    } = await loadModule();

    const largeBlob = new Blob(
      [new Uint8Array(NATIVE_MEDIA_WRITE_CHUNK_BYTES + 32)],
      { type: "audio/mpeg" },
    );

    await saveAudioFile("track-large", largeBlob, "audio/mpeg");

    expect(filesystemMocks.writeFile).toHaveBeenCalledTimes(1);
    expect(filesystemMocks.writeFile).toHaveBeenCalledWith({
      path: "media/audio/track-large.mp3",
      data: expect.any(String),
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
      recursive: true,
    });
    expect(filesystemMocks.appendFile).toHaveBeenCalledTimes(1);
    expect(filesystemMocks.appendFile).toHaveBeenCalledWith({
      path: "media/audio/track-large.mp3",
      data: expect.any(String),
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
  });

  it("cleans up partial native files when a later chunk append fails", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.appendFile.mockRejectedValueOnce(new Error("append failed"));

    const {
      saveAudioFile,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
      NATIVE_MEDIA_WRITE_CHUNK_BYTES,
    } = await loadModule();

    const largeBlob = new Blob(
      [new Uint8Array(NATIVE_MEDIA_WRITE_CHUNK_BYTES + 32)],
      { type: "audio/mpeg" },
    );

    await expect(saveAudioFile("track-cleanup", largeBlob, "audio/mpeg")).rejects.toThrow(
      "append failed",
    );

    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: "media/audio/track-cleanup.mp3",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
  });

  it("rejects unsafe track IDs and raw PC-style path inputs", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const { saveAudioFile } = await loadModule();
    const blob = new Blob(["audio"], { type: "audio/mpeg" });

    await expect(saveAudioFile("../track", blob, "audio/mpeg")).rejects.toThrow(
      "safe app-local identifier",
    );
    await expect(saveAudioFile("track/1", blob, "audio/mpeg")).rejects.toThrow(
      "safe app-local identifier",
    );
    await expect(saveAudioFile("track\\1", blob, "audio/mpeg")).rejects.toThrow(
      "safe app-local identifier",
    );
    await expect(saveAudioFile("C:\\Music", blob, "audio/mpeg")).rejects.toThrow(
      "safe app-local identifier",
    );
    await expect(saveAudioFile("S:\\Music", blob, "audio/mpeg")).rejects.toThrow(
      "safe app-local identifier",
    );
    await expect(
      saveAudioFile("\\\\DESKTOP\\Music", blob, "audio/mpeg"),
    ).rejects.toThrow("safe app-local identifier");

    expect(filesystemMocks.writeFile).not.toHaveBeenCalled();
  });

  it("resolves stored audio URIs by safe track ID prefix", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.readdir.mockResolvedValue({
      files: [
        {
          name: "track-1.mp3",
          type: "file",
          size: 10,
          mtime: 1,
          uri: "file:///app/media/audio/track-1.mp3",
        },
      ],
    });
    filesystemMocks.getUri.mockResolvedValue({
      uri: "file:///app/media/audio/track-1.mp3",
    });

    const {
      getAudioFileUri,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
    } = await loadModule();
    const uri = await getAudioFileUri("track-1");

    expect(filesystemMocks.readdir).toHaveBeenCalledWith({
      path: "media/audio",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
    expect(filesystemMocks.getUri).toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
    expect(uri).toBe("file:///app/media/audio/track-1.mp3");
  });

  it("returns safe stat details and existence for app-owned files", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const {
      statNativeMediaFile,
      nativeMediaFileExists,
      getNativeMediaFileSize,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
    } = await loadModule();

    const stat = await statNativeMediaFile("media/audio/track-1.mp3");
    const exists = await nativeMediaFileExists("media/audio/track-1.mp3");
    const size = await getNativeMediaFileSize("media/audio/track-1.mp3");

    expect(filesystemMocks.stat).toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
    expect(stat).toEqual(
      expect.objectContaining({
        type: "file",
        size: 42,
      }),
    );
    expect(exists).toBe(true);
    expect(size).toBe(42);
  });

  it("resolves a playable native audio URI from a safe relative path", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.getUri.mockResolvedValue({
      uri: "file:///app/media/audio/track-1.mp3",
    });

    const {
      getPlayableNativeAudioUri,
      NATIVE_MEDIA_STORAGE_DIRECTORY,
    } = await loadModule();
    const uri = await getPlayableNativeAudioUri("media/audio/track-1.mp3");

    expect(filesystemMocks.stat).toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
    expect(filesystemMocks.getUri).toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
    expect(uri).toBe("http://localhost/_capacitor_file_//app/media/audio/track-1.mp3");
    expect(uri.startsWith("file://")).toBe(false);
  });

  it("converts raw content URIs into WebView-playable artwork URLs", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.getUri.mockResolvedValue({
      uri: "content://app/media/artwork/track-1.jpg",
    });

    const { getPlayableNativeArtworkUri } = await loadModule();
    const uri = await getPlayableNativeArtworkUri("media/artwork/track-1.jpg");

    expect(uri).toBe(
      "http://localhost/_capacitor_content_/app/media/artwork/track-1.jpg",
    );
  });

  it("rejects unsafe stat paths and returns false for missing files", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.stat.mockImplementation(async ({ path }) => {
      if (path === "media/audio/missing.mp3") {
        throw new Error("not found");
      }

      return {
        type: "file",
        size: 42,
        uri: "file:///app/media/audio/track-1.mp3",
      };
    });

    const {
      statNativeMediaFile,
      nativeMediaFileExists,
      getNativeMediaFileSize,
    } = await loadModule();

    await expect(statNativeMediaFile("C:/Music/song.mp3")).rejects.toThrow(
      "raw PC filesystem paths",
    );
    expect(await nativeMediaFileExists("media/audio/missing.mp3")).toBe(false);
    expect(await getNativeMediaFileSize("media/audio/missing.mp3")).toBeNull();
  });

  it("resolves stored audio URIs when readdir returns names without explicit file type", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.readdir.mockResolvedValue({
      files: [
        {
          name: "track-2.mp3",
          size: 10,
          mtime: 1,
          uri: "file:///app/media/audio/track-2.mp3",
        },
      ],
    });
    filesystemMocks.getUri.mockResolvedValue({
      uri: "file:///app/media/audio/track-2.mp3",
    });

    const { getAudioFileUri } = await loadModule();
    const uri = await getAudioFileUri("track-2");

    expect(uri).toBe("file:///app/media/audio/track-2.mp3");
    expect(filesystemMocks.getUri).toHaveBeenCalledWith({
      path: "media/audio/track-2.mp3",
      directory: "DATA",
    });
  });

  it("deletes audio files by resolved safe relative path", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.readdir.mockResolvedValue({
      files: [
        {
          name: "track-9.mp3",
          type: "file",
          size: 10,
          mtime: 1,
          uri: "file:///app/media/audio/track-9.mp3",
        },
        {
          name: "track-9.bin",
          type: "file",
          size: 8,
          mtime: 2,
          uri: "file:///app/media/audio/track-9.bin",
        },
      ],
    });

    const { deleteAudioFile } = await loadModule();
    const deleted = await deleteAudioFile("track-9");

    expect(deleted).toBe(true);
    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: "media/audio/track-9.mp3",
      directory: "DATA",
    });
    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: "media/audio/track-9.bin",
      directory: "DATA",
    });
  });

  it("clears all stored audio and artwork files from app-owned storage", async () => {
    isNativePlatform = true;
    currentPlatform = "android";
    filesystemMocks.readdir
      .mockResolvedValueOnce({
        files: [
          {
            name: "track-1.mp3",
            type: "file",
            size: 10,
            mtime: 1,
            uri: "file:///app/media/audio/track-1.mp3",
          },
        ],
      })
      .mockResolvedValueOnce({
        files: [
          {
            name: "track-1.jpg",
            type: "file",
            size: 10,
            mtime: 1,
            uri: "file:///app/media/artwork/track-1.jpg",
          },
        ],
      });

    const { clearNativeMediaFiles } = await loadModule();
    const result = await clearNativeMediaFiles();

    expect(result).toEqual({
      deletedAudioFiles: 1,
      deletedArtworkFiles: 1,
    });
    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: "media/audio/track-1.mp3",
      directory: "DATA",
    });
    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: "media/artwork/track-1.jpg",
      directory: "DATA",
    });
  });
});
