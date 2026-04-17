export default function TrackSortControls({
    search,
    setSearch,
    appliedSearch,
    setAppliedSearch,
    sortBy,
    setSortBy,
    order,
    setOrder,
    setPage
}) {
  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by title, artist, or album"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "300px",
            padding: "8px",
            marginRight: "8px",
          }}
        />

        <button
          onClick={() => {
            setPage(1);
            setAppliedSearch(search);
          }}
        >
          Search
        </button>

        <button
          onClick={() => {
            setSearch("");
            setAppliedSearch("");
            setPage(1);
          }}
          style={{ marginLeft: "8px" }}
        >
          Clear Search
        </button>
      </div>

      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <label>Sort by:</label>

        <select
          value={sortBy}
          onChange={(e) => {
            setPage(1);
            setSortBy(e.target.value);
          }}
        >
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="album">Album</option>
          <option value="duration">Duration</option>
        </select>

        <select
          value={order}
          onChange={(e) => {
            setPage(1);
            setOrder(e.target.value);
          }}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
    </>
  );
}