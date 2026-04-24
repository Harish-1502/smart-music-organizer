export default function PlaylistTrackRow({ track, onRemove }) {
  return (
    <div>
      <span>{track.position}. </span>
      <strong>{track.title}</strong>
      <span> — {track.artist || "Unknown Artist"}</span>

      <button onClick={() => onRemove(track.playlist_track_id)}>
        Remove
      </button>
    </div>
  );
}