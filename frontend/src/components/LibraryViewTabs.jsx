export default function LibraryViewTabs({
    onChangeView, 
    onRefresh,
    refreshDisabled,
}) {
    return (
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        <button onClick={() => onChangeView("tracks")}>Tracks</button>
        <button onClick={() => onChangeView("artists")}>Artists</button>
        <button onClick={() => onChangeView("albums")}>Albums</button>
        <button onClick={onRefresh} disabled={refreshDisabled}>
          Refresh
        </button>
      </div>   
    )
}