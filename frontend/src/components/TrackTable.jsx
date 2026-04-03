import {
  displayValue,
  formatDuration,
  formatMetadataSource,
} from "../utils/trackFormatters";

function handleEditTrack(track) {
    console.log("Edit track:", track);

  
}

export default function TrackTable({ tracks }) {
  if (!tracks || tracks.length === 0) {
    return <p>No tracks found.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "12px",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Art</th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Artist</th>
            <th style={thStyle}>Album</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>File Name</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {tracks.map((track) => (
            <tr key={track.id}>
              <td style={tdStyle}>
                {track.art_path ? (
                  <img
                    src={toImageUrl(track.art_path)}
                    alt={track.title || track.file_name}
                    style={imageStyle}
                  />
                ) : (
                  <div style={placeholderStyle}>—</div>
                )}
              </td>

              <td style={tdStyle}>{displayValue(track.title)}</td>
              <td style={tdStyle}>{displayValue(track.artist)}</td>
              <td style={tdStyle}>{displayValue(track.album)}</td>
              <td style={tdStyle}>{formatDuration(track.duration)}</td>
              <td style={tdStyle}>
                {formatMetadataSource(track.metadata_source)}
              </td>
              <td style={tdStyle}>{displayValue(track.file_name)}</td>
              <td style={tdStyle}> 
                <button onClick={() => handleEditTrack(track)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "2px solid #ccc",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #eee",
};

const imageStyle = {
  width: "48px",
  height: "48px",
  objectFit: "cover",
  borderRadius: "6px",
  border: "1px solid #ddd",
};

const placeholderStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "6px",
  backgroundColor: "#eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  color: "#666",
  border: "1px solid #ddd",
};

function toImageUrl(artPath) {
  return `http://127.0.0.1:8000/library/art?path=${encodeURIComponent(
    artPath
  )}`;
}