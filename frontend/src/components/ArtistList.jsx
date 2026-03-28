export default function ArtistList({ artists, onArtistClick }) {
  return (
    <div>
      {artists.map((item) => (
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
          <span>{item.artist}</span>
          <span>{item.track_count} tracks</span>
        </div>
      ))}
    </div>
  );
}