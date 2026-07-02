import { maskAlbumItem } from "../../../utils/demoMode";

export default function AlbumList({ albums, onAlbumClick }) {
  return (
    <div>
      {albums.map((item, index) => {
        const displayItem = maskAlbumItem(item, index);

        return (
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
              <div>{displayItem.album}</div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                {displayItem.artist || "Unknown Artist"}
              </div>
            </div>

            <span>{item.track_count} tracks</span>
          </div>
        );
      })}
    </div>
  );
}
