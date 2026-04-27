import {
  displayValue,
  formatDuration,
  formatMetadataSource,
} from "../utils/trackFormatters";

export default function TrackTable({
  tracks,
  onEdit,
  mode = "library",
  selectedTrackIds = [],
  onToggleTrack,
}) {
  return (
    <table border="1" cellPadding="8" style={{ width: "100%" }}>
      <thead>
        <tr>
          {mode === "picker" && <th>Select</th>}
          <th>Title</th>
          <th>Artist</th>
          <th>Album</th>
          <th>Duration</th>
          <th>File Name</th>
          {mode === "library" && <th>Actions</th>}
        </tr>
      </thead>

      <tbody>
        {tracks.map((track) => (
          <tr key={track.id}>
            {mode === "picker" && (
              <td>
                <input
                  type="checkbox"
                  checked={selectedTrackIds.includes(track.id)}
                  onChange={() => onToggleTrack(track.id)}
                />
              </td>
            )}

            <td>{track.title}</td>
            <td>{track.artist || "—"}</td>
            <td>{track.album || "—"}</td>
            <td>{track.duration || "—"}</td>
            <td>{track.file_name}</td>

            {mode === "library" && (
              <td>
                <button onClick={() => onEdit(track)}>Edit</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}