// Small data-shaping helpers used by DownloadedPage controllers and UI.
export function sortPlaylistsByDownloadedDate(playlists) {
  return [...playlists].sort((left, right) => {
    const leftDate = new Date(left?.downloadedAt ?? 0).getTime();
    const rightDate = new Date(right?.downloadedAt ?? 0).getTime();

    return rightDate - leftDate;
  });
}

export function createEmptyLibraryProgress() {
  return {
    totalLibraryTracks: 0,
    totalMissingTracks: 0,
    processedMissingTracks: 0,
    verifiedExistingCount: 0,
    downloadedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    downloadedBytes: 0,
    currentTrackTitle: "",
    lastSafeErrorMessage: "",
  };
}

export function createOfflineDatabaseUnavailableUiMessage() {
  return "Offline database is unavailable. The library was found, but the phone database could not be opened. Try clearing app storage or reinstalling if this continues.";
}
