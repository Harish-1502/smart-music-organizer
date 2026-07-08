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
  categoryOptions = [],
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
  const normalizedCategoryOptions =
    categoryOptions.length > 0
      ? categoryOptions
      : ["mood", "genre", "activity", "energy", "source", "language", "custom"];

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
            <div className="edit-track-modal__tag-sections">
              {tagsError ? (
                <p className="edit-track-modal__message" role="alert">
                  {tagsError}
                </p>
              ) : null}

              <section
                className="edit-track-modal__tag-section"
                aria-labelledby="edit-track-current-tags-title"
              >
                <div className="edit-track-modal__tag-section-header">
                  <div>
                    <h3
                      id="edit-track-current-tags-title"
                      className="edit-track-modal__tag-section-title"
                    >
                      Current Tags
                    </h3>
                    <p className="edit-track-modal__tag-section-subtitle">
                      Tags already attached to this track.
                    </p>
                  </div>
                </div>

                {tagsLoading ? (
                  <p className="edit-track-modal__helper">Loading tags...</p>
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
                  <p className="edit-track-modal__tag-empty">
                    No tags attached yet.
                  </p>
                )}
              </section>

              <section
                className="edit-track-modal__tag-section"
                aria-labelledby="edit-track-add-existing-title"
              >
                <div className="edit-track-modal__tag-section-header">
                  <div>
                    <h3
                      id="edit-track-add-existing-title"
                      className="edit-track-modal__tag-section-title"
                    >
                      Add Existing Tag
                    </h3>
                    <p className="edit-track-modal__tag-section-subtitle">
                      Choose from tags already in your library.
                    </p>
                  </div>
                </div>

                <div className="edit-track-modal__tag-select-row">
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
                      {availableTags.length > 0
                        ? "Select a tag"
                        : "No existing tags available"}
                    </option>
                    {availableTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name} ({tag.category})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="edit-track-modal__button edit-track-modal__button--secondary edit-track-modal__button--compact"
                    onClick={onAddTag}
                    disabled={!selectedTagId || tagActionLoading || tagsLoading}
                  >
                    {tagActionLoading ? "Working..." : "Add"}
                  </button>
                </div>
              </section>

              <section
                className="edit-track-modal__tag-section"
                aria-labelledby="edit-track-create-tag-title"
              >
                <div className="edit-track-modal__tag-section-header">
                  <div>
                    <h3
                      id="edit-track-create-tag-title"
                      className="edit-track-modal__tag-section-title"
                    >
                      Create New Tag
                    </h3>
                    <p className="edit-track-modal__tag-section-subtitle">
                      Create a new tag and attach it to this track.
                    </p>
                  </div>
                </div>

                <div className="edit-track-modal__create-grid">
                  <input
                    id="edit-track-tag-name"
                    className="edit-track-modal__input"
                    type="text"
                    placeholder="Tag name"
                    value={newTagForm.name}
                    onChange={(e) => onNewTagChange("name", e.target.value)}
                    disabled={tagActionLoading}
                  />

                  <select
                    id="edit-track-tag-category"
                    className="edit-track-modal__input edit-track-modal__select"
                    value={newTagForm.category}
                    onChange={(e) => onNewTagChange("category", e.target.value)}
                    disabled={tagActionLoading}
                  >
                    <option value="">Select category</option>
                    {normalizedCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="edit-track-modal__button edit-track-modal__button--primary edit-track-modal__create-action"
                  onClick={onCreateTag}
                  disabled={
                    tagActionLoading ||
                    !newTagForm.name.trim() ||
                    !newTagForm.category.trim()
                  }
                >
                  {tagActionLoading ? "Working..." : "Create"}
                </button>
              </section>
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
