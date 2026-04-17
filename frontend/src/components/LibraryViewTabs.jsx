export default function LibraryViewTabs({
    setViewMode, 
    handleRefresh,
    loading, 
    tracksLoading
}) {
    return (
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        <button onClick={() => setViewMode("tracks")}>Tracks</button>
        <button onClick={() => setViewMode("artists")}>Artists</button>
        <button onClick={() => setViewMode("albums")}>Albums</button>
        <button onClick={handleRefresh} disabled={loading || tracksLoading}>
          Refresh
        </button>
      </div>   
    )
}