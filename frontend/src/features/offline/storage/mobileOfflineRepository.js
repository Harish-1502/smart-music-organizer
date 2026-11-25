// Public entry point for offline storage and services.
// Preserves existing imports while implementations live in focused modules.

export { initializeMobileOfflineDb } from "./mobileSqliteDb";

export {
  normalizeOfflineTrackMetadata,
} from "./repository/offlineMetadata";

export {
  OfflineMetadataSaveError,
  OfflineDatabaseUnavailableError,
} from "./repository/offlineErrors";

export {
  shouldUseMobileOfflineSqlite,
  ensureMobileOfflineDbReady,
} from "./repository/offlineDbHelpers";

export {
  getOfflineTrack,
  saveOfflineTrackMetadata,
  saveOfflineMediaFileRef,
  saveOfflineTrackWithMediaRefs,
} from "./repository/offlineTrackRepository";

export {
  hasOfflinePlaylist,
  getOfflinePlaylists,
  getOfflineTracksForPlaylist,
  saveOfflinePlaylistMetadata,
  saveOfflinePlaylistTracks,
} from "./repository/offlinePlaylistRepository";

export {
  saveNativeDownloadedPlaylist,
} from "./repository/offlinePlaylistPersistence";

export {
  deleteOfflinePlaylist,
  clearMobileOfflineData,
  clearOfflineData,
} from "./repository/offlineCleanup";

export {
  hasVerifiedOfflineTrack,
  getBulkOfflineTrackVerification,
  getOfflineStorageSummary,
} from "./repository/offlineStorageHealth";

export { getOfflineLibraryTracks } from "../services/offlineLibraryView";

export {
  getOfflineTrackAudioSource,
  getOfflinePlaylistForPlayback,
  buildOfflinePlaybackQueue,
} from "../services/offlinePlayback";

export {
  inspectNativeMediaFilesForPlaylist,
  inspectDownloadedPlaylist,
} from "../services/offlineDiagnostics";
