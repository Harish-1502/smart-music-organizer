export default function LibraryViewTabs({
    onChangeView, 
    onRefresh,
    refreshDisabled,
}) {
  return (
    <div className="library-tabs" role="toolbar" aria-label="Library views">
      <div className="library-tabs__group" role="group" aria-label="Choose view">
        <button
          type="button"
          className="library-tabs__button"
          onClick={() => onChangeView("tracks")}
        >
          Tracks
        </button>
        <button
          type="button"
          className="library-tabs__button"
          onClick={() => onChangeView("artists")}
        >
          Artists
        </button>
        <button
          type="button"
          className="library-tabs__button"
          onClick={() => onChangeView("albums")}
        >
          Albums
        </button>
      </div>

      <button
        type="button"
        className="library-tabs__button library-tabs__button--secondary"
        onClick={onRefresh}
        disabled={refreshDisabled}
      >
        Refresh
      </button>
    </div>
  );

}