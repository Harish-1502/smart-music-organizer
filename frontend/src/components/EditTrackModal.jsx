export default function EditTrackModal({
  isOpen,
  formData,
  onChange,
  onSave,
  onCancel,
}) {
  if (!isOpen) return null;

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
