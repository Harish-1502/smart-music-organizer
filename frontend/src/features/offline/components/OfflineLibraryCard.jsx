// Full-library download section for LAN-backed offline sync and progress.
export default function OfflineLibraryCard({
  summaryCards,
  noteMessage,
  progressCard,
  lanModeEnabled,
  isLibraryLoading,
  libraryTracksKnown,
  isLibraryDownloading,
  libraryProgress,
  libraryStatus,
  libraryDatabaseUnavailable,
  onDownloadFullLibrary,
  onCancelFullLibraryDownload,
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
        {summaryCards.map((card) => (
          <div key={card.label} className="downloaded-page__summary-card">
            <span className="downloaded-page__summary-label">{card.label}</span>
            <span
              className={`downloaded-page__summary-value${
                card.compact
                  ? " downloaded-page__summary-value--compact"
                  : ""
              }`}
            >
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {noteMessage ? (
        <p className="downloaded-page__library-note">{noteMessage}</p>
      ) : null}

      {progressCard ? (
        <div className="downloaded-page__download-card" aria-live="polite">
          <p className="downloaded-page__warning-title">{progressCard.title}</p>
          <p className="downloaded-page__warning-text">{progressCard.summary}</p>
          {progressCard.currentTrack ? (
            <p className="downloaded-page__warning-text">
              {progressCard.currentTrack}
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
