// Full-library download section for LAN-backed offline sync and progress.
export default function OfflineLibraryCard({
  lanModeEnabled,
  isLibraryLoading,
  libraryTracksKnown,
  isLibraryDownloading,
  libraryProgress,
  libraryStatus,
  libraryDatabaseUnavailable,
  onDownloadFullLibrary,
  onCancelFullLibraryDownload,
  formatStorageSize,
  buildLibraryTransferSummary,
  sanitizeLibraryProgressTitle,
  createOfflineDatabaseUnavailableUiMessage,
}) {
  return (
    <section
      className="downloaded-page__library-card"
      aria-labelledby="offline-library-title"
    >
      <div className="downloaded-page__library-copy">
        <p className="downloaded-page__section-eyebrow">Offline Library</p>
        <h2
          id="offline-library-title"
          className="downloaded-page__section-title"
        >
          Full library download
        </h2>
        <p className="downloaded-page__state-text">
          Download your PC music library for Offline Mode browsing and
          playback.
        </p>
      </div>

      <div
        className="downloaded-page__summary-grid"
        aria-label="Offline library download summary"
      >
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">
            PC library tracks
          </span>
          <span className="downloaded-page__summary-value">
            {isLibraryLoading ? "..." : libraryTracksKnown}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">
            Already downloaded
          </span>
          <span className="downloaded-page__summary-value">
            {isLibraryDownloading
              ? Number(libraryProgress.verifiedExistingCount ?? 0) +
                Number(libraryProgress.downloadedCount ?? 0) +
                Number(libraryProgress.skippedCount ?? 0)
              : isLibraryLoading
                ? "..."
                : libraryStatus?.available
                  ? libraryStatus.alreadyDownloadedCount
                  : libraryDatabaseUnavailable
                    ? "--"
                    : 0}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">New downloads</span>
          <span className="downloaded-page__summary-value">
            {isLibraryDownloading
              ? Math.max(
                  libraryProgress.totalMissingTracks -
                    libraryProgress.processedMissingTracks,
                  0,
                )
              : isLibraryLoading
                ? "..."
                : libraryStatus?.available
                  ? libraryStatus.missingDownloadCount
                  : libraryDatabaseUnavailable
                    ? "--"
                    : 0}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">
            Estimated size
          </span>
          <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
            Estimated size unavailable
          </span>
        </div>
      </div>

      {!lanModeEnabled ? (
        <p className="downloaded-page__library-note">
          Switch to LAN Mode to download from your PC library.
        </p>
      ) : null}

      {lanModeEnabled && !isLibraryLoading && libraryDatabaseUnavailable ? (
        <p className="downloaded-page__library-note">
          {createOfflineDatabaseUnavailableUiMessage()}
        </p>
      ) : null}

      {lanModeEnabled &&
      !isLibraryLoading &&
      !libraryStatus?.available &&
      !libraryDatabaseUnavailable ? (
        <p className="downloaded-page__library-note">
          Connect to your PC backend in LAN Mode to inspect the full library.
        </p>
      ) : null}

      {lanModeEnabled &&
      !isLibraryLoading &&
      libraryStatus?.available &&
      libraryStatus.totalLibraryTracks === 0 ? (
        <p className="downloaded-page__library-note">
          No tracks found in your PC library right now.
        </p>
      ) : null}

      {isLibraryDownloading ? (
        <div className="downloaded-page__download-card" aria-live="polite">
          <p className="downloaded-page__warning-title">
            Downloading full library
          </p>
          <p className="downloaded-page__warning-text">
            {libraryProgress.processedMissingTracks} /{" "}
            {libraryProgress.totalMissingTracks} missing tracks processed.{" "}
            {buildLibraryTransferSummary(libraryProgress)} Fetched{" "}
            {formatStorageSize(libraryProgress.downloadedBytes)} so far.
          </p>
          {libraryProgress.currentTrackTitle ? (
            <p className="downloaded-page__warning-text">
              Current track:{" "}
              {sanitizeLibraryProgressTitle(libraryProgress.currentTrackTitle)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="downloaded-page__library-actions">
        <button
          type="button"
          className="downloaded-page__button"
          onClick={onDownloadFullLibrary}
          disabled={
            !lanModeEnabled ||
            isLibraryDownloading ||
            isLibraryLoading ||
            !libraryStatus?.available
          }
        >
          {isLibraryDownloading
            ? "Downloading library..."
            : "Download Full Library"}
        </button>
        {isLibraryDownloading ? (
          <button
            type="button"
            className="downloaded-page__button downloaded-page__button--secondary"
            onClick={onCancelFullLibraryDownload}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
