import { Link } from "react-router-dom";

export default function PlaylistCard({ playlist, onDelete }) {
  return (
    <div>
      <Link to={`/playlists/${playlist.id}`}>
        <h3>{playlist.name}</h3>
      </Link>

      <button onClick={() => onDelete(playlist.id)}>
        Delete
      </button>
    </div>
  );
}