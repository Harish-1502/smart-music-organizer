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
    return (
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
            <input
              placeholder="Filter by artist"
              value={artistFilter}
              onChange={(e) => {
                setPage(1);
                setArtistFilter(e.target.value);
              }}
            />

            <input
              placeholder="Filter by album"
              value={albumFilter}
              onChange={(e) => {
                setPage(1);
                setAlbumFilter(e.target.value);
              }}
            />

            <select
              value={extensionFilter}
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

            <button onClick={clearAllFilters}>Clear All</button>
          </div>
    )
}