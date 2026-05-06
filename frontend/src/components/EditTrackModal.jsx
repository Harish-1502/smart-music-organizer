export default function EditTrackModal({
  isOpen,
  formData,
  artPreviewUrl,
  allTags = [],
  trackTags = [],
  tagsLoading = false,
  tagsError = "",
  selectedTagId = "",
  tagActionLoading = false,
  newTagForm = { name: "", category: "" },
  onChange,
  onArtFileChange,
  onSelectedTagChange,
  onNewTagChange,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onSave,
  onCancel,
}) {
  if (!isOpen) return null;

  const attachedTagIds = new Set(trackTags.map((tag) => tag.tag_id));
  const availableTags = allTags.filter((tag) => !attachedTagIds.has(tag.id));

  return (
    <div className="edit-track-modal__overlay">
      <div
        className="edit-track-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-track-modal-title"
      >
        <div className="edit-track-modal__header">
          <h2 id="edit-track-modal-title" className="edit-track-modal__title">
            Edit Track
          </h2>
          <p className="edit-track-modal__subtitle">
            Update the track details shown in your library.
          </p>
        </div>

        <div className="edit-track-modal__content">
          <div className="edit-track-modal__field">
            <label className="edit-track-modal__label" htmlFor="edit-track-title">
              Title
            </label>
            <input
              id="edit-track-title"
              className="edit-track-modal__input"
              type="text"
              value={formData.title}
              onChange={(e) => onChange("title", e.target.value)}
            />
          </div>

          <div className="edit-track-modal__field">
            <label
              className="edit-track-modal__label"
              htmlFor="edit-track-artist"
            >
              Artist
            </label>
            <input
              id="edit-track-artist"
              className="edit-track-modal__input"
              type="text"
              value={formData.artist}
              onChange={(e) => onChange("artist", e.target.value)}
            />
          </div>

          <div className="edit-track-modal__field">
            <label className="edit-track-modal__label" htmlFor="edit-track-album">
              Album
            </label>
            <input
              id="edit-track-album"
              className="edit-track-modal__input"
              type="text"
              value={formData.album}
              onChange={(e) => onChange("album", e.target.value)}
            />
          </div>

          <div className="edit-track-modal__field">
            <label className="edit-track-modal__label" htmlFor="edit-track-art">
              Artwork
            </label>

            <input
              id="edit-track-art"
              className="edit-track-modal__input"
              type="file"
              accept="image/*"
              onChange={(e) => onArtFileChange(e.target.files?.[0])}
            />

            {artPreviewUrl && (
              <img
                className="edit-track-modal__art-preview"
                src={artPreviewUrl}
                alt="Track artwork preview"
              />
            )}
          </div>

          <div className="edit-track-modal__field">
            <span className="edit-track-modal__label">Tags</span>

            {tagsLoading ? (
              <p className="edit-track-modal__helper">Loading tags...</p>
            ) : tagsError ? (
              <p className="edit-track-modal__message" role="alert">
                {tagsError}
              </p>
            ) : trackTags.length > 0 ? (
              <div className="edit-track-modal__tag-list" aria-label="Track tags">
                {trackTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="edit-track-modal__tag-chip edit-track-modal__tag-chip--removable"
                    onClick={() => onRemoveTag(tag.tag_id)}
                    disabled={tagActionLoading}
                    aria-label={`Remove ${tag.name} tag`}
                  >
                    <span className="edit-track-modal__tag-name">{tag.name}</span>
                    <span className="edit-track-modal__tag-category">
                      {tag.category}
                    </span>
                    <span
                      className="edit-track-modal__tag-remove"
                      aria-hidden="true"
                    >
                      x
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="edit-track-modal__helper">No tags attached.</p>
            )}
          </div>

          <div className="edit-track-modal__field">
            <label
              className="edit-track-modal__label"
              htmlFor="edit-track-tag-select"
            >
              Add tag
            </label>

            <div className="edit-track-modal__inline-actions">
              <select
                id="edit-track-tag-select"
                className="edit-track-modal__input edit-track-modal__select"
                value={selectedTagId}
                onChange={(e) => onSelectedTagChange(e.target.value)}
                disabled={
                  tagsLoading || tagActionLoading || availableTags.length === 0
                }
              >
                <option value="">
                  {availableTags.length > 0 ? "Select a tag" : "No tags available"}
                </option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name} ({tag.category})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="edit-track-modal__button edit-track-modal__button--secondary"
                onClick={onAddTag}
                disabled={!selectedTagId || tagActionLoading || tagsLoading}
              >
                {tagActionLoading ? "Working..." : "Add"}
              </button>
            </div>
          </div>

          <div className="edit-track-modal__field">
            <span className="edit-track-modal__label">Create new tag</span>

            <div className="edit-track-modal__stack">
              <input
                id="edit-track-tag-name"
                className="edit-track-modal__input"
                type="text"
                placeholder="Tag name"
                value={newTagForm.name}
                onChange={(e) => onNewTagChange("name", e.target.value)}
                disabled={tagActionLoading}
              />

              <input
                id="edit-track-tag-category"
                className="edit-track-modal__input"
                type="text"
                placeholder="Category"
                value={newTagForm.category}
                onChange={(e) => onNewTagChange("category", e.target.value)}
                disabled={tagActionLoading}
              />

              <button
                type="button"
                className="edit-track-modal__button edit-track-modal__button--secondary"
                onClick={onCreateTag}
                disabled={
                  tagActionLoading ||
                  !newTagForm.name.trim() ||
                  !newTagForm.category.trim()
                }
              >
                {tagActionLoading ? "Working..." : "Create"}
              </button>
            </div>
          </div>
        </div>

        <div className="edit-track-modal__actions">
          <button
            type="button"
            className="edit-track-modal__button edit-track-modal__button--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="edit-track-modal__button edit-track-modal__button--primary"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
