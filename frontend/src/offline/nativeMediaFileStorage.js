import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

export const NATIVE_MEDIA_STORAGE_DIRECTORY = Directory.Data;
export const NATIVE_MEDIA_ROOT_DIR = "media";
export const NATIVE_MEDIA_AUDIO_DIR = `${NATIVE_MEDIA_ROOT_DIR}/audio`;
export const NATIVE_MEDIA_ARTWORK_DIR = `${NATIVE_MEDIA_ROOT_DIR}/artwork`;

const AUDIO_EXTENSION_BY_MIME = {
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-flac": "flac",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
};

const ARTWORK_EXTENSION_BY_MIME = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class NativeMediaStorageUnsupportedError extends Error {
  constructor(message = "Native Android media file storage is not supported.") {
    super(message);
    this.name = "NativeMediaStorageUnsupportedError";
  }
}

function isAlreadyExistsError(error) {
  const message =
    typeof error?.message === "string" ? error.message.toLowerCase() : "";

  return message.includes("exist") || message.includes("already");
}

function normalizeTrackIdSegment(trackId) {
  if (trackId === null || trackId === undefined) {
    throw new Error("Track ID is required.");
  }

  const normalizedTrackId =
    typeof trackId === "string" ? trackId.trim() : String(trackId);

  if (!normalizedTrackId) {
    throw new Error("Track ID is required.");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(normalizedTrackId)) {
    throw new Error("Track ID must be a safe app-local identifier.");
  }

  return normalizedTrackId;
}

function ensureSafeRelativePath(relativePath) {
  const normalizedPath =
    typeof relativePath === "string" ? relativePath.trim().replaceAll("\\", "/") : "";

  if (!normalizedPath) {
    throw new Error("Media path must not be empty.");
  }

  if (/^[a-zA-Z]:\//.test(normalizedPath) || normalizedPath.startsWith("//")) {
    throw new Error("Media path must not contain raw PC filesystem paths.");
  }

  if (normalizedPath.startsWith("/") || normalizedPath.includes("/../") || normalizedPath.startsWith("../")) {
    throw new Error("Media path traversal is not allowed.");
  }

  if (!normalizedPath.startsWith(`${NATIVE_MEDIA_ROOT_DIR}/`)) {
    throw new Error("Media path must stay within app-owned storage.");
  }

  return normalizedPath;
}

function normalizeMimeType(mimeType, blob) {
  const explicitType = typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";
  const blobType = typeof blob?.type === "string" ? blob.type.trim().toLowerCase() : "";

  return explicitType || blobType || "";
}

function resolveExtension(kind, mimeType) {
  const extensionMap =
    kind === "audio" ? AUDIO_EXTENSION_BY_MIME : ARTWORK_EXTENSION_BY_MIME;

  return extensionMap[mimeType] ?? (kind === "audio" ? "bin" : "img");
}

function getKindDirectory(kind) {
  return kind === "audio" ? NATIVE_MEDIA_AUDIO_DIR : NATIVE_MEDIA_ARTWORK_DIR;
}

function getKindPrefix(kind) {
  return kind === "audio" ? "audio" : "artwork";
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function ensureNativeSupport() {
  if (!isNativeMediaFileStorageSupported()) {
    throw new NativeMediaStorageUnsupportedError();
  }
}

async function ensureDirectory(path) {
  try {
    await Filesystem.mkdir({
      path,
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
      recursive: true,
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }
}

async function listDirectoryFiles(path) {
  try {
    const result = await Filesystem.readdir({
      path,
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });

    return Array.isArray(result?.files) ? result.files : [];
  } catch {
    return [];
  }
}

async function findStoredRelativePath(kind, trackId) {
  ensureNativeSupport();

  const safeTrackId = normalizeTrackIdSegment(trackId);
  const directoryPath = getKindDirectory(kind);
  const files = await listDirectoryFiles(directoryPath);
  const expectedPrefix = `${safeTrackId}.`;

  const match = files.find((file) => {
    const name = typeof file === "string" ? file : file?.name;
    const type =
      typeof file === "string" ? "file" : file?.type ?? (typeof name === "string" ? "file" : null);

    return type === "file" && typeof name === "string" && name.startsWith(expectedPrefix);
  });

  if (!match) {
    return null;
  }

  const fileName = typeof match === "string" ? match : match.name;
  return ensureSafeRelativePath(`${directoryPath}/${fileName}`);
}

async function saveMediaFile(kind, trackId, blob, mimeType) {
  ensureNativeSupport();

  if (!(blob instanceof Blob)) {
    throw new Error(`${getKindPrefix(kind)} blob is required.`);
  }

  const safeTrackId = normalizeTrackIdSegment(trackId);
  const normalizedMimeType = normalizeMimeType(mimeType, blob);
  const extension = resolveExtension(kind, normalizedMimeType);
  const relativePath = ensureSafeRelativePath(
    `${getKindDirectory(kind)}/${safeTrackId}.${extension}`,
  );

  await initializeNativeMediaStorage();

  const base64Data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: relativePath,
    data: base64Data,
    directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    recursive: true,
  });

  return {
    relativePath,
    uri: result?.uri ?? null,
    mimeType: normalizedMimeType || null,
    storageType: "native_file",
  };
}

async function getMediaFileUri(kind, trackId) {
  const relativePath = await findStoredRelativePath(kind, trackId);

  if (!relativePath) {
    return null;
  }

  const result = await Filesystem.getUri({
    path: relativePath,
    directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
  });

  return result?.uri ?? null;
}

export async function statNativeMediaFile(relativePath) {
  ensureNativeSupport();
  const safeRelativePath = ensureSafeRelativePath(relativePath);

  try {
    const result = await Filesystem.stat({
      path: safeRelativePath,
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });

    return {
      type: typeof result?.type === "string" ? result.type : null,
      size:
        Number.isFinite(Number(result?.size)) && Number(result?.size) >= 0
          ? Number(result.size)
          : null,
      uri: result?.uri ?? null,
      ctime:
        Number.isFinite(Number(result?.ctime)) && Number(result?.ctime) >= 0
          ? Number(result.ctime)
          : null,
      mtime:
        Number.isFinite(Number(result?.mtime)) && Number(result?.mtime) >= 0
          ? Number(result.mtime)
          : null,
    };
  } catch {
    return null;
  }
}

export async function nativeMediaFileExists(relativePath) {
  const stat = await statNativeMediaFile(relativePath);
  return Boolean(stat);
}

export async function getNativeMediaFileSize(relativePath) {
  const stat = await statNativeMediaFile(relativePath);
  return stat?.size ?? null;
}

async function deleteMediaFile(kind, trackId) {
  const relativePath = await findStoredRelativePath(kind, trackId);

  if (!relativePath) {
    return false;
  }

  await Filesystem.deleteFile({
    path: relativePath,
    directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
  });

  return true;
}

export function isNativeMediaFileStorageSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function initializeNativeMediaStorage() {
  ensureNativeSupport();
  await ensureDirectory(NATIVE_MEDIA_AUDIO_DIR);
  await ensureDirectory(NATIVE_MEDIA_ARTWORK_DIR);
  return true;
}

export async function saveAudioFile(trackId, blob, mimeType) {
  return saveMediaFile("audio", trackId, blob, mimeType);
}

export async function saveArtworkFile(trackId, blob, mimeType) {
  return saveMediaFile("artwork", trackId, blob, mimeType);
}

export async function getAudioFileUri(trackId) {
  return getMediaFileUri("audio", trackId);
}

export async function getArtworkFileUri(trackId) {
  return getMediaFileUri("artwork", trackId);
}

export async function deleteAudioFile(trackId) {
  return deleteMediaFile("audio", trackId);
}

export async function deleteArtworkFile(trackId) {
  return deleteMediaFile("artwork", trackId);
}

export async function clearNativeMediaFiles() {
  ensureNativeSupport();

  let deletedAudioFiles = 0;
  let deletedArtworkFiles = 0;

  for (const [kind, directoryPath] of [
    ["audio", NATIVE_MEDIA_AUDIO_DIR],
    ["artwork", NATIVE_MEDIA_ARTWORK_DIR],
  ]) {
    const files = await listDirectoryFiles(directoryPath);

    for (const file of files) {
      const fileName = typeof file === "string" ? file : file?.name;
      const fileType =
        typeof file === "string"
          ? "file"
          : file?.type ?? (typeof fileName === "string" ? "file" : null);

      if (fileType !== "file" || typeof fileName !== "string") {
        continue;
      }

      await Filesystem.deleteFile({
        path: ensureSafeRelativePath(`${directoryPath}/${fileName}`),
        directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
      });

      if (kind === "audio") {
        deletedAudioFiles += 1;
      } else {
        deletedArtworkFiles += 1;
      }
    }
  }

  return {
    deletedAudioFiles,
    deletedArtworkFiles,
  };
}
