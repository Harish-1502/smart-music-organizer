import { maskArtistItem } from "../utils/demoMode";

export default function ArtistList({ artists, onArtistClick }) {
  return (
    <div>
      {artists.map((item, index) => {
        const displayItem = maskArtistItem(item, index);

        return (
          <div
            key={item.artist}
            onClick={() => onArtistClick(item.artist)}
            style={{
              padding: "12px",
              borderBottom: "1px solid #ddd",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{displayItem.artist}</span>
            <span>{item.track_count} tracks</span>
          </div>
        );
      })}
    </div>
  );
}
