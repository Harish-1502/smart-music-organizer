// Top-level storage summary for the downloaded/offline area.
export default function DownloadedHero({
  summary,
  storageAvailable,
  formatStorageSize,
  formatStorageType,
}) {
  return (
    <header className="downloaded-page__hero">
      <div className="downloaded-page__hero-copy">
        <p className="downloaded-page__eyebrow">Offline foundation</p>
        <h1 id="downloaded-title" className="downloaded-page__title">
          Downloaded
        </h1>
        <p className="downloaded-page__lead">
          Review what is already stored for offline listening. No API token or
          PC file path is shown here.
        </p>
      </div>

      <div
        className="downloaded-page__summary-grid"
        aria-label="Offline storage summary"
      >
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Storage</span>
          <span className="downloaded-page__summary-value">
            {storageAvailable ? "Available" : "Unavailable"}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Playlists</span>
          <span className="downloaded-page__summary-value">
            {summary?.playlistCount ?? 0}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Storage type</span>
          <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
            {formatStorageType(summary?.storageType)}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Tracks</span>
          <span className="downloaded-page__summary-value">
            {summary?.trackCount ?? 0}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Audio size</span>
          <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
            {formatStorageSize(summary?.totalAudioBytes ?? 0)}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Artwork size</span>
          <span className="downloaded-page__summary-value downloaded-page__summary-value--compact">
            {formatStorageSize(summary?.totalArtworkBytes ?? 0)}
          </span>
        </div>
        <div className="downloaded-page__summary-card">
          <span className="downloaded-page__summary-label">Offline total</span>
          <span className="downloaded-page__summary-value">
            {formatStorageSize(summary?.totalBytes ?? 0)}
          </span>
        </div>
      </div>
    </header>
  );
}
