export default function ScanProgress({ status }) {
  if (!status) return null;

  return (
    <section
      className="scan-progress"
      data-status={String(status.status || "").toLowerCase()}
      aria-labelledby="scan-progress-title"
      aria-live="polite"
    >
      <div className="scan-progress__header">
        <div className="scan-progress__header-copy">
          <h2 id="scan-progress-title" className="scan-progress__title">
            Scan status
          </h2>
          <p
            className="scan-progress__current-file"
            title={status.current_file || "None"}
          >
            {status.current_file || "None"}
          </p>
        </div>

        <span className="scan-progress__status-badge">{status.status}</span>
      </div>

      <dl className="scan-progress__grid">
        <div className="scan-progress__stat">
          <dt>Status</dt>
          <dd>{status.status}</dd>
        </div>
        <div className="scan-progress__stat">
          <dt>Files seen</dt>
          <dd>{status.files_seen}</dd>
        </div>
        <div className="scan-progress__stat">
          <dt>Supported found</dt>
          <dd>{status.supported_found}</dd>
        </div>
        <div className="scan-progress__stat">
          <dt>Inserted</dt>
          <dd>{status.inserted}</dd>
        </div>
        <div className="scan-progress__stat">
          <dt>Duplicates</dt>
          <dd>{status.duplicates}</dd>
        </div>
        <div className="scan-progress__stat">
          <dt>User edited</dt>
          <dd>{status.user_edited}</dd>
        </div>
        <div className="scan-progress__stat">
          <dt>Failed</dt>
          <dd>{status.failed}</dd>
        </div>
      </dl>

      {status.last_error && (
        <p className="scan-progress__error">Error: {status.last_error}</p>
      )}
    </section>
  );
}
