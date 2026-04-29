import { Link, Routes, Route, Navigate } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";
import PlayerPage from "./pages/PlayerPage.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <nav className="app-shell__nav" aria-label="Primary">
        <div className="app-shell__nav-inner">
          <Link
            to="/"
            className="app-shell__brand"
            aria-label="Smart Music Organizer home"
          >
            <span className="app-shell__brand-mark" aria-hidden="true">
              SM
            </span>
            <span className="app-shell__brand-copy">
              <span className="app-shell__brand-name">Smart Music</span>
              <span className="app-shell__brand-subtitle">Organizer</span>
            </span>
          </Link>

          <div
            className="app-shell__nav-links"
            role="group"
            aria-label="Primary destinations"
          >
            <Link to="/library" className="app-shell__nav-link">
              Library
            </Link>
            <Link to="/playlists" className="app-shell__nav-link">
              Playlists
            </Link>
            <Link to="/player" className="app-shell__nav-link">
              Player
            </Link>
          </div>

          <div className="app-shell__nav-actions" aria-hidden="true">
            <span className="app-shell__nav-placeholder">
              Search / Settings
            </span>
          </div>
        </div>
      </nav>

      <main className="app-shell__main">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
          <Route path="/player" element={<PlayerPage />} />
        </Routes>
      </main>
    </div>
  );
}
