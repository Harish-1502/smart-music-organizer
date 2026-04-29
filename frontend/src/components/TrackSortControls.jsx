export default function TrackSortControls({
  search,
  onSearchChange,
  appliedSearch,
  setAppliedSearch,
  sortBy,
  onSortChange,
  order,
  onOrderChange,
  setPage
}) {
  return (
    <>
      <div className="track-browser__search-row">
        <input
          className="track-browser__input track-browser__input--search"
          type="text"
          placeholder="Search by title, artist, or album"
          value={search}
          aria-label="Search tracks"
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <div className="track-browser__search-actions">
          <button
            type="button"
            className="track-browser__button track-browser__button--secondary"
            onClick={() => {
              setPage(1);
              setAppliedSearch(search);
            }}
          >
            Search
          </button>

          <button
            type="button"
            className="track-browser__button track-browser__button--secondary"
            onClick={() => {
              onSearchChange("");
              setAppliedSearch("");
              setPage(1);
            }}
          >
            Clear Search
          </button>
        </div>
      </div>

      <div className="track-browser__sort-row">
        <select
          className="track-browser__select"
          value={sortBy}
          aria-label="Sort tracks by"
          onChange={(e) => {
            setPage(1);
            onSortChange(e.target.value);
          }}
        >
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="album">Album</option>
          <option value="duration">Duration</option>
        </select>

        <select
          className="track-browser__select"
          value={order}
          aria-label="Sort order"
          onChange={(e) => {
            setPage(1);
            onOrderChange(e.target.value);
          }}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
    </>
  );
}
