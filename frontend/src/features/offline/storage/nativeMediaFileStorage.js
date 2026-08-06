import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

export const NATIVE_MEDIA_STORAGE_DIRECTORY = Directory.Data;
export const NATIVE_MEDIA_ROOT_DIR = "media";
export const NATIVE_MEDIA_AUDIO_DIR = `${NATIVE_MEDIA_ROOT_DIR}/audio`;
export const NATIVE_MEDIA_ARTWORK_DIR = `${NATIVE_MEDIA_ROOT_DIR}/artwork`;
export const NATIVE_MEDIA_WRITE_CHUNK_BYTES = 384 * 1024;

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

// Ensures the provided relative path is safe and does not allow 
// directory traversal or access to raw filesystem paths. 
// This is important to keep the media files within the app-owned storage
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

function yieldForChunkedNativeWrite() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function blobToBase64WithFileReader(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error("Blob base64 conversion failed."));
    };

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");

      if (commaIndex < 0) {
        reject(new Error("Blob base64 conversion returned an invalid data URL."));
        return;
      }

      resolve(result.slice(commaIndex + 1));
    };

    reader.readAsDataURL(blob);
  });
}

async function blobToBase64(blob) {
  if (typeof FileReader === "function") {
    return blobToBase64WithFileReader(blob);
  }

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

async function writeBlobToRelativePath(relativePath, blob) {
  const safeRelativePath = ensureSafeRelativePath(relativePath);
  let wroteAnyData = false;

  try {
    for (
      let offset = 0;
      offset < blob.size || (blob.size === 0 && offset === 0);
      offset += NATIVE_MEDIA_WRITE_CHUNK_BYTES
    ) {
      const chunk =
        blob.size === 0
          ? blob
          : blob.slice(offset, Math.min(offset + NATIVE_MEDIA_WRITE_CHUNK_BYTES, blob.size));
      const base64Data = await blobToBase64(chunk);

      if (!wroteAnyData) {
        await Filesystem.writeFile({
          path: safeRelativePath,
          data: base64Data,
          directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
          recursive: true,
        });
        wroteAnyData = true;
      } else {
        await Filesystem.appendFile({
          path: safeRelativePath,
          data: base64Data,
          directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
        });
      }

      if (blob.size > NATIVE_MEDIA_WRITE_CHUNK_BYTES) {
        await yieldForChunkedNativeWrite();
      }

      if (blob.size === 0) {
        break;
      }
    }
  } catch (error) {
    if (wroteAnyData) {
      try {
        await Filesystem.deleteFile({
          path: safeRelativePath,
          directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
        });
      } catch {}
    }

    throw error;
  }
}

function ensureNativeSupport() {
  if (!isNativeMediaFileStorageSupported()) {
    throw new NativeMediaStorageUnsupportedError();
  }
}

function toPlayableWebViewUri(nativeUri) {
  if (typeof nativeUri !== "string" || !nativeUri.trim()) {
    return null;
  }

  const trimmedUri = nativeUri.trim();

  if (trimmedUri.startsWith("file://") || trimmedUri.startsWith("content://")) {
    return Capacitor.convertFileSrc(trimmedUri);
  }

  return trimmedUri;
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

function getDirectoryFileName(file) {
  return typeof file === "string" ? file : file?.name;
}

function getDirectoryFileType(file) {
  const fileName = getDirectoryFileName(file);

  return typeof file === "string"
    ? "file"
    : file?.type ?? (typeof fileName === "string" ? "file" : null);
}

async function listMatchingRelativePaths(kind, trackId) {
  ensureNativeSupport();

  const safeTrackId = normalizeTrackIdSegment(trackId);
  const directoryPath = getKindDirectory(kind);
  const files = await listDirectoryFiles(directoryPath);
  const expectedPrefix = `${safeTrackId}.`;

  return files
    .filter((file) => {
      const name = getDirectoryFileName(file);
      const type = getDirectoryFileType(file);

      return type === "file" && typeof name === "string" && name.startsWith(expectedPrefix);
    })
    .map((file) => ensureSafeRelativePath(`${directoryPath}/${getDirectoryFileName(file)}`));
}

async function deleteRelativePaths(relativePaths) {
  let deletedCount = 0;

  for (const relativePath of relativePaths) {
    await Filesystem.deleteFile({
      path: ensureSafeRelativePath(relativePath),
      directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
    });
    deletedCount += 1;
  }

  return deletedCount;
}

async function deleteMatchingMediaFiles(kind, trackId, excludeRelativePath = null) {
  const matchingPaths = await listMatchingRelativePaths(kind, trackId);
  const safeExcludedPath =
    typeof excludeRelativePath === "string" && excludeRelativePath.trim()
      ? ensureSafeRelativePath(excludeRelativePath)
      : null;
  const pathsToDelete = safeExcludedPath
    ? matchingPaths.filter((relativePath) => relativePath !== safeExcludedPath)
    : matchingPaths;

  if (pathsToDelete.length === 0) {
    return 0;
  }

  return deleteRelativePaths(pathsToDelete);
}

async function findStoredRelativePath(kind, trackId) {
  ensureNativeSupport();

  const matchingPaths = await listMatchingRelativePaths(kind, trackId);

  if (matchingPaths.length === 0) {
    return null;
  }

  return matchingPaths[0];
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
  await deleteMatchingMediaFiles(kind, safeTrackId, relativePath);

  await writeBlobToRelativePath(relativePath, blob);
  const result = await Filesystem.getUri({
    path: relativePath,
    directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
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

async function getPlayableNativeMediaUri(relativePath) {
  ensureNativeSupport();
  const safeRelativePath = ensureSafeRelativePath(relativePath);
  const stat = await statNativeMediaFile(safeRelativePath);

  if (!stat) {
    return null;
  }

  const result = await Filesystem.getUri({
    path: safeRelativePath,
    directory: NATIVE_MEDIA_STORAGE_DIRECTORY,
  });

  return toPlayableWebViewUri(result?.uri ?? null);
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

// Retrieves the the playable URI for a native audio file stored 
// in the app's pro 
export async function getPlayableNativeAudioUri(relativePath) {
  return getPlayableNativeMediaUri(relativePath);
}

export async function getPlayableNativeArtworkUri(relativePath) {
  return getPlayableNativeMediaUri(relativePath);
}

async function deleteMediaFile(kind, trackId) {
  const deletedCount = await deleteMatchingMediaFiles(kind, trackId);
  return deletedCount > 0;
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
      const fileName = getDirectoryFileName(file);
      const fileType = getDirectoryFileType(file);

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
