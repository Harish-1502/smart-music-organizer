import { Link, Routes, Route, Navigate } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";

export default function App() {
  return (
    <div className="app-shell">
      <nav className="app-shell__nav" aria-label="Primary">
        <div className="app-shell__nav-inner">
          <Link to="/library" className="app-shell__nav-link">
            Library
          </Link>
          <Link to="/playlists" className="app-shell__nav-link">
            Playlists
          </Link>
        </div>
      </nav>

      <main className="app-shell__main">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}