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
    handleEditTrack,
    handleFormChange,
    handleCancelEdit,
    handleSaveEdit,
  } = useTrackEdit({ loadTracks, setMessage: () => {} });

    return (
        <div>
            <h2>{mode === "picker" ? "Select Tracks" : "Tracks"}</h2>

            {message && <p>{message}</p>}

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

            <p>Total Tracks: {totalItems}</p>

            {tracksLoading ? (
                <p>Loading tracks...</p>
            ) : tracks.length === 0 ? (
                <p>No tracks found.</p>
            ) : (
                <>
                <TrackTable
                    tracks={tracks}
                    onEdit={mode === "library" ? handleEditTrack : undefined}
                    mode={mode}
                    selectedTrackIds={selectedTrackIds}
                    onToggleTrack={onToggleTrack}
                />

                {mode === "library" && (
                    <EditTrackModal
                    isOpen={showModal}
                    formData={editForm}
                    onChange={handleFormChange}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    />
                )}

                <div
                    style={{
                    marginTop: "16px",
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    }}
                >
                    <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    >
                    Previous
                    </button>

                    <span>
                    Page {page} of {totalPages}
                    </span>

                    <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages}
                    >
                    Next
                    </button>
                </div>
                </>
            )}
        </div>
    );
}