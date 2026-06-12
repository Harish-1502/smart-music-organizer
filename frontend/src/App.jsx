import { useEffect, useState } from "react";
// import { runAndroidOfflineFoundationSmokeTest } from "./offline/androidOfflineFoundationSmokeTest";
import { Link, Routes, Route, Navigate } from "react-router-dom";
import { API_AUTH_REQUIRED_EVENT } from "./api/apiBase";
import {
  API_TOKEN_UPDATED_EVENT,
  clearApiToken,
} from "./api/authToken";
import ApiTokenPrompt from "./components/ApiTokenPrompt";
import LibraryPage from "./pages/LibraryPage";
import ConnectionPage from "./pages/ConnectionPage";
import DownloadedPage from "./pages/DownloadedPage";
import PlaylistsPage from "./features/playlists/pages/PlaylistsPage";
import PlaylistDetailPage from "./features/playlists/pages/PlaylistDetailPage";
import PlayerPage from "./pages/PlayerPage.jsx";
import TagCalibrationPage from "./pages/TagCalibrationPage.jsx";
import MiniPlayer from "./components/MiniPlayer";
import { usePlayer } from "./context/PlayerContext";

export default function App() {
  const { currentTrack, audioRef, isPlaying, streamUrl, handleEnded } = usePlayer();
  const hasMiniPlayer = Boolean(currentTrack);
  const [showApiTokenPrompt, setShowApiTokenPrompt] = useState(false);
  const [authRefreshKey, setAuthRefreshKey] = useState(0);

  useEffect(() => {
    // runAndroidOfflineFoundationSmokeTest({ allowInProduction: true });

    function handleApiAuthRequired() {
      clearApiToken();
      setShowApiTokenPrompt(true);
    }

    function handleApiTokenUpdated(event) {
      const tokenConfigured = Boolean(event?.detail?.configured);

      if (tokenConfigured) {
        setShowApiTokenPrompt(false);
        setAuthRefreshKey((currentKey) => currentKey + 1);
      }
    }

    window.addEventListener(API_AUTH_REQUIRED_EVENT, handleApiAuthRequired);
    window.addEventListener(API_TOKEN_UPDATED_EVENT, handleApiTokenUpdated);

    return () => {
      window.removeEventListener(API_AUTH_REQUIRED_EVENT, handleApiAuthRequired);
      window.removeEventListener(API_TOKEN_UPDATED_EVENT, handleApiTokenUpdated);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current || !currentTrack || !streamUrl || !isPlaying) {
      return;
    }

    try {
      const playPromise = audioRef.current.play();
      playPromise?.catch(() => {});
    } catch {}
  }, [audioRef, currentTrack, streamUrl, isPlaying]);

  return (
    <div
      className={`app-shell${hasMiniPlayer ? " app-shell--has-mini-player" : ""}`}
    >
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
            <Link to="/calibration" className="app-shell__nav-link">
              Calibration
            </Link>
            <Link to="/connection" className="app-shell__nav-link">
              Connection
            </Link>
            <Link to="/downloaded" className="app-shell__nav-link">
              Downloaded
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
        <Routes key={authRefreshKey}>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route
            path="/playlists/:playlistId"
            element={<PlaylistDetailPage />}
          />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/calibration" element={<TagCalibrationPage />} />
          <Route path="/connection" element={<ConnectionPage />} />
          <Route path="/downloaded" element={<DownloadedPage />} />
        </Routes>
      </main>

      <MiniPlayer />

      <ApiTokenPrompt
        open={showApiTokenPrompt}
        onClose={() => setShowApiTokenPrompt(false)}
      />

      {currentTrack ? (
        <audio
          ref={audioRef}
          src={streamUrl}
          autoPlay
          preload="metadata"
          onEnded={handleEnded}
        />
      ) : null}
    </div>
  );
}
