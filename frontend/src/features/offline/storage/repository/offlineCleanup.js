import {
  clearOfflineDownloads,
  deleteDownloadedPlaylist,
} from "../offlineStorage";
import {
  clearNativeMediaFiles,
  deleteAudioFile,
  deleteArtworkFile,
} from "../nativeMediaFileStorage";
import {
  normalizeOfflineId,
  normalizePositiveInteger,
} from "./offlineMetadataUtils";
import {
  shouldUseMobileOfflineSqlite,
  withMobileOfflineTransaction,
} from "./offlineDbHelpers";

export async function bestEffortDeleteNativeTrackFiles(trackIds) {
  if (!shouldUseMobileOfflineSqlite()) {
    return;
  }

  for (const trackId of trackIds) {
    try {
      await deleteAudioFile(trackId);
    } catch {}

    try {
      await deleteArtworkFile(trackId);
    } catch {}
  }
}

export async function deleteOfflinePlaylist(playlistId) {
  const normalizedPlaylistId = normalizeOfflineId(playlistId);

  if (!normalizedPlaylistId) {
    return false;
  }

  // This the browser path of deleting a downloaded playlist
  if (!shouldUseMobileOfflineSqlite()) {
    return deleteDownloadedPlaylist(normalizedPlaylistId);
  }

  // This is the mobile path of deleting a downloaded playlist
  const result = await withMobileOfflineTransaction(async (database) => {

    // Query the database to get all the track IDs associated with the playlist being deleted
    const trackRows = await database.query(
      "SELECT track_id AS trackId FROM offline_playlist_tracks WHERE playlist_id = ?",
      [normalizedPlaylistId],
    );
    const trackIds = Array.isArray(trackRows?.values)
      ? trackRows.values
          .map((row) => normalizeOfflineId(row?.trackId))
          .filter((trackId) => trackId !== null)
      : [];

    await database.run(
      "DELETE FROM offline_downloads WHERE entity_type = 'playlist' AND entity_id = ?",
      [normalizedPlaylistId],
      false,
    );
    await database.run(
      "DELETE FROM offline_playlist_tracks WHERE playlist_id = ?",
      [normalizedPlaylistId],
      false,
    );
    await database.run(
      "DELETE FROM offline_playlists WHERE id = ?",
      [normalizedPlaylistId],
      false,
    );

    const deletedTrackIds = [];

    for (const trackId of trackIds) {
      const remainingPlaylistRows = await database.query(
        "SELECT COUNT(*) AS count FROM offline_playlist_tracks WHERE track_id = ?",
        [trackId],
      );
      const remainingCount = normalizePositiveInteger(
        remainingPlaylistRows?.values?.[0]?.count,
      );

      // If the track is still referenced by other playlists, the loop skips it
      if (remainingCount > 0) {
        continue;
      }

      await database.run(
        "DELETE FROM offline_media_files WHERE track_id = ?",
        [trackId],
        false,
      );
      await database.run(
        "DELETE FROM offline_downloads WHERE entity_type = 'track' AND entity_id = ?",
        [trackId],
        false,
      );
      await database.run(
        "DELETE FROM offline_tracks WHERE id = ?",
        [trackId],
        false,
      );
      deletedTrackIds.push(trackId);
    }

    return {
      deletedTrackIds,
    };
  });

  if (!result) {
    return false;
  }

  await bestEffortDeleteNativeTrackFiles(result.deletedTrackIds ?? []);
  return true;
}

export async function clearMobileOfflineData() {
  if (!shouldUseMobileOfflineSqlite()) {
    return clearOfflineDownloads();
  }

  const result = await withMobileOfflineTransaction(async (database) => {
    await database.run("DELETE FROM offline_media_files", [], false);
    await database.run("DELETE FROM offline_playlist_tracks", [], false);
    await database.run("DELETE FROM offline_downloads", [], false);
    await database.run("DELETE FROM offline_tracks", [], false);
    await database.run("DELETE FROM offline_playlists", [], false);
    return true;
  });

  if (!result) {
    return false;
  }

  try {
    await clearNativeMediaFiles();
  } catch {}

  return true;
}

export async function clearOfflineData() {
  return shouldUseMobileOfflineSqlite()
    ? clearMobileOfflineData()
    : clearOfflineDownloads();
}
