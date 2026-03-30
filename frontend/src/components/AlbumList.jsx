export default function AlbumList({ albums, onAlbumClick }) {
  return (
    <div>
      {albums.map((item, index) => (
        <div
          key={`${item.album}-${item.artist}-${index}`}
          onClick={() => onAlbumClick(item.album)}
          style={{
            padding: "12px",
            borderBottom: "1px solid #ddd",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div>{item.album}</div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              {item.artist || "Unknown Artist"}
            </div>
          </div>

          <span>{item.track_count} tracks</span>
        </div>
      ))}
    </div>
  );
}