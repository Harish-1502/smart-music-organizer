import { isDemoMode } from "../utils/demoMode";

export default function TrackFilterControls({ 
  artistFilter, 
  albumFilter,
  extensionFilter,
  setPage,
  setArtistFilter,
  setAlbumFilter,
  setExtensionFilter,
  clearAllFilters 
}) {
  const demoModeEnabled = isDemoMode();

  return (
    <div className="track-browser__filter-row">
      <input
        className="track-browser__input"
        type={demoModeEnabled ? "password" : "text"}
        placeholder={demoModeEnabled ? "Artist filter hidden" : "Filter by artist"}
        value={artistFilter}
        aria-label="Filter tracks by artist"
        onChange={(e) => {
          setPage(1);
          setArtistFilter(e.target.value);
        }}
      />

      <input
        className="track-browser__input"
        type={demoModeEnabled ? "password" : "text"}
        placeholder={demoModeEnabled ? "Album filter hidden" : "Filter by album"}
        value={albumFilter}
        aria-label="Filter tracks by album"
        onChange={(e) => {
          setPage(1);
          setAlbumFilter(e.target.value);
        }}
      />

      <select
        className="track-browser__select"
        value={extensionFilter}
        aria-label="Filter tracks by file format"
        onChange={(e) => {
          setPage(1);
          setExtensionFilter(e.target.value);
        }}
      >
        <option value="">All</option>
        <option value=".mp3">MP3</option>
        <option value=".flac">FLAC</option>
        <option value=".wav">WAV</option>
      </select>

      <button
        type="button"
        className="track-browser__button track-browser__button--danger-ghost"
        onClick={clearAllFilters}
      >
        Clear All
      </button>
    </div>
  );
}
