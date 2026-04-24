import { Link, Routes, Route, Navigate } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";

export default function App() {
  return (
    <div>
      <nav style={{ display: "flex", gap: "12px", padding: "12px" }}>
        <Link to="/library">Library</Link>
        <Link to="/playlists">Playlists</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
      </Routes>
    </div>
  );
}