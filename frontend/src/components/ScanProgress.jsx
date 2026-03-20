export default function ScanProgress({ status }) {
  if (!status) return null

  return (
    <div>
      <p>Status: {status.status}</p>
      <p>Current File: {status.current_file || "None"}</p>
      <p>Files Seen: {status.files_seen}</p>
      <p>Supported Found: {status.supported_found}</p>
      <p>Inserted: {status.inserted}</p>
      <p>Duplicates: {status.duplicates}</p>
      <p>Failed: {status.failed}</p>
      {status.last_error && <p>Error: {status.last_error}</p>}
    </div>
  )
}