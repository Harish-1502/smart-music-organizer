import {
  clearMobileOfflineData,
  getOfflinePlaylists,
  initializeMobileOfflineDb,
  saveOfflinePlaylistMetadata,
  saveOfflinePlaylistTracks,
  saveOfflineTrackMetadata,
} from "../storage/mobileOfflineRepository";
import {
  clearNativeMediaFiles,
  deleteAudioFile,
  getAudioFileUri,
  initializeNativeMediaStorage,
  isNativeMediaFileStorageSupported,
  saveAudioFile,
} from "../storage/nativeMediaFileStorage";

// Dev-only helper for manually validating the Android offline foundations.
// It intentionally logs only pass/fail booleans and never logs private paths or tokens.
export async function runAndroidOfflineFoundationSmokeTest({
  logger = console,
  allowInProduction = false,
} = {}) {
  if (
    !allowInProduction &&
    typeof import.meta !== "undefined" &&
    !import.meta.env?.DEV
  ) {
    const result = { skipped: true, reason: "disabled_outside_dev" };
    logger.info?.("[offline-smoke] skipped");
    return result;
  }

  const sqliteSteps = {
    initialize: false,
    writeMetadata: false,
    readMetadata: false,
    clearMetadata: false,
  };
  const fileSteps = {
    initialize: false,
    writeFile: false,
    readUri: false,
    deleteFile: false,
    clearFiles: false,
  };
  const fileFailure = {
    step: null,
    errorName: null,
    errorMessage: null,
    relativePath: null,
  };
  const expectedTestAudioPath = "media/audio/smoke-audio.mp3";

  function captureFileFailure(step, error, relativePath = null) {
    fileFailure.step = step;
    fileFailure.errorName = error?.name ?? "Error";
    fileFailure.errorMessage =
      typeof error?.message === "string" ? error.message : "Unknown error";
    fileFailure.relativePath = relativePath;
  }

  try {
    sqliteSteps.initialize = await initializeMobileOfflineDb();

    if (sqliteSteps.initialize) {
      const savedTrack = await saveOfflineTrackMetadata({
        id: "smoke-track",
        title: "Smoke Track",
        artist: "Smoke Artist",
        album: "Smoke Album",
        duration: 1,
        downloadStatus: "downloaded",
      });
      const savedPlaylist = await saveOfflinePlaylistMetadata({
        id: "smoke-playlist",
        name: "Smoke Playlist",
        totalTracks: 1,
        totalBytes: 1,
        downloadStatus: "downloaded",
      });
      const savedOrder = await saveOfflinePlaylistTracks("smoke-playlist", [
        "smoke-track",
      ]);

      sqliteSteps.writeMetadata = Boolean(
        savedTrack && savedPlaylist && savedOrder,
      );

      const playlists = await getOfflinePlaylists();
      sqliteSteps.readMetadata = playlists.some(
        (playlist) => playlist?.id === "smoke-playlist",
      );

      sqliteSteps.clearMetadata = await clearMobileOfflineData();
    }
  } catch {
    sqliteSteps.clearMetadata = false;
  }

  try {
    if (isNativeMediaFileStorageSupported()) {
      try {
        fileSteps.initialize = await initializeNativeMediaStorage();
      } catch (error) {
        captureFileFailure("initialize", error);
        throw error;
      }

      let savedFile = null;
      try {
        savedFile = await saveAudioFile(
          "smoke-audio",
          new Blob(["smoke"], { type: "audio/mpeg" }),
          "audio/mpeg",
        );
        fileSteps.writeFile = Boolean(savedFile?.relativePath);
      } catch (error) {
        captureFileFailure("write", error, expectedTestAudioPath);
        throw error;
      }

      try {
        const fileUri = await getAudioFileUri("smoke-audio");
        fileSteps.readUri = Boolean(fileUri);

        if (!fileSteps.readUri) {
          captureFileFailure(
            "getUri",
            new Error("Native media URI was not found."),
            savedFile?.relativePath ?? expectedTestAudioPath,
          );
          throw new Error("Native media URI was not found.");
        }
      } catch (error) {
        if (!fileFailure.step) {
          captureFileFailure(
            "getUri",
            error,
            savedFile?.relativePath ?? expectedTestAudioPath,
          );
        }
        throw error;
      }

      try {
        fileSteps.deleteFile = await deleteAudioFile("smoke-audio");

        if (!fileSteps.deleteFile) {
          captureFileFailure(
            "delete",
            new Error("Native media test file was not deleted."),
            savedFile?.relativePath ?? expectedTestAudioPath,
          );
          throw new Error("Native media test file was not deleted.");
        }
      } catch (error) {
        if (!fileFailure.step) {
          captureFileFailure(
            "delete",
            error,
            savedFile?.relativePath ?? expectedTestAudioPath,
          );
        }
        throw error;
      }

      try {
        const cleared = await clearNativeMediaFiles();
        fileSteps.clearFiles =
          typeof cleared?.deletedAudioFiles === "number" &&
          typeof cleared?.deletedArtworkFiles === "number";

        if (!fileSteps.clearFiles) {
          captureFileFailure(
            "clear",
            new Error("Native media storage clear did not return counts."),
          );
          throw new Error("Native media storage clear did not return counts.");
        }
      } catch (error) {
        if (!fileFailure.step) {
          captureFileFailure("clear", error);
        }
        throw error;
      }
    }
  } catch {
    fileSteps.clearFiles = false;
  }

  const result = {
    sqlite: sqliteSteps,
    nativeMedia: fileSteps,
  };

  logger.info?.(
    "[offline-smoke] sqlite init:",
    sqliteSteps.initialize ? "pass" : "fail",
  );
  logger.info?.(
    "[offline-smoke] sqlite write/read/clear:",
    sqliteSteps.writeMetadata &&
      sqliteSteps.readMetadata &&
      sqliteSteps.clearMetadata
      ? "pass"
      : "fail",
  );
  logger.info?.(
    "[offline-smoke] native media init/write/read/delete/clear:",
    fileSteps.initialize &&
      fileSteps.writeFile &&
      fileSteps.readUri &&
      fileSteps.deleteFile &&
      fileSteps.clearFiles
      ? "pass"
      : "fail",
  );
  if (fileFailure.step) {
    logger.info?.(
      "[offline-smoke] native media failed step:",
      fileFailure.step,
    );
    logger.info?.(
      "[offline-smoke] native media error:",
      `${fileFailure.errorName}: ${fileFailure.errorMessage}`,
    );
    if (fileFailure.relativePath) {
      logger.info?.(
        "[offline-smoke] native media safe path:",
        fileFailure.relativePath,
      );
    }
  }

  return result;
}
