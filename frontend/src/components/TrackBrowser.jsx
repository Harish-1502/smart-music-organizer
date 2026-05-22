import useTrackEdit from "../hooks/useTrackEdit";
import EditTrackModal from "./EditTrackModal";
import TrackFilterControls from "./TrackFilterControls";
import TrackSortControls from "./TrackSortControls";
import TrackTable from "./TrackTable"; 

export default function TrackBrowser({
  browser,
  mode = "library",
  selectedTrackIds = [],
  onToggleTrack,
  onPlayTrack,
}) {
  const {
    tracks,
    tracksLoading,
    message,

    page,
    setPage,
    totalPages,
    totalItems,

    search,
    setSearch,
    setAppliedSearch,

    sortBy,
    setSortBy,
    order,
    setOrder,

    artistFilter,
    setArtistFilter,
    albumFilter,
    setAlbumFilter,
    extensionFilter,
    setExtensionFilter,

    loadTracks,
    clearAllFilters,
  } = browser;

  const {
    showModal,
    editForm,
    artPreviewUrl,
    allTags,
    trackTags,
    // tagSuggestions,
    tagsLoading,
    tagsError,
    selectedTagId,
    tagActionLoading,
    newTagForm,
    categoryOptions,
    handleEditTrack,
    handleFormChange,
    handleArtFileChange,
    handleSelectedTagChange,
    handleNewTagChange,
    handleAddTag,
    handleRemoveTag,
    handleCreateTag,
    handleCancelEdit,
    handleSaveEdit,
  } = useTrackEdit({ loadTracks, setMessage: () => {} });

  return (
    <div className={`track-browser track-browser--${mode}`}>
      <div className="track-browser__header">
        <h2 className="track-browser__title">
          {mode === "picker" ? "Select Tracks" : "Tracks"}
        </h2>
        <p className="track-browser__summary">Total Tracks: {totalItems}</p>
      </div>

      {message && <p className="track-browser__message">{message}</p>}

      <div className="track-browser__toolbar-card">
        <TrackSortControls
          search={search}
          onSearchChange={setSearch}
          setAppliedSearch={setAppliedSearch}
          sortBy={sortBy}
          onSortChange={setSortBy}
          order={order}
          onOrderChange={setOrder}
          setPage={setPage}
        />

        <TrackFilterControls
          artistFilter={artistFilter}
          albumFilter={albumFilter}
          extensionFilter={extensionFilter}
          setPage={setPage}
          setArtistFilter={setArtistFilter}
          setAlbumFilter={setAlbumFilter}
          setExtensionFilter={setExtensionFilter}
          clearAllFilters={clearAllFilters}
        />
      </div>

      {tracksLoading ? (
        <p className="track-browser__state">Loading tracks...</p>
      ) : tracks.length === 0 ? (
        <p className="track-browser__state">No tracks found.</p>
      ) : (
        <>
          <TrackTable
            tracks={tracks}
            onEdit={mode === "library" ? handleEditTrack : undefined}
            mode={mode}
            selectedTrackIds={selectedTrackIds}
            onToggleTrack={onToggleTrack}
            onPlayTrack={onPlayTrack}
          />

          {mode === "library" && (
            <EditTrackModal
              isOpen={showModal}
              formData={editForm}
              artPreviewUrl={artPreviewUrl}
              allTags={allTags}
              trackTags={trackTags}
              tagsLoading={tagsLoading}
              tagsError={tagsError}
              selectedTagId={selectedTagId}
              tagActionLoading={tagActionLoading}
              newTagForm={newTagForm}
              categoryOptions={categoryOptions}
              onChange={handleFormChange}
              onArtFileChange={handleArtFileChange}
              onSelectedTagChange={handleSelectedTagChange}
              onNewTagChange={handleNewTagChange}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onCreateTag={handleCreateTag}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          )}

          <div className="track-browser__pagination">
            <div
              className="track-browser__pagination-pill"
              role="group"
              aria-label="Track pagination"
            >
              <button
                type="button"
                className="track-browser__button track-browser__button--secondary"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
              >
                Previous
              </button>

              <span className="track-browser__pagination-status">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="track-browser__button track-browser__button--secondary"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
