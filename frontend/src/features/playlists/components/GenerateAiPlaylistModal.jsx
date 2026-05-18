import { useState } from "react";
import { getApiErrorMessage } from "../../../api/apiErrors";

export default function GenerateAiPlaylistModal({ onClose, onGenerate }) {
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("Enter a prompt to generate a playlist.");
      return;
    }

    if (trimmedPrompt.length < 8) {
      setError("Add a little more detail so the playlist can be generated.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onGenerate(trimmedPrompt);
      setPrompt("");
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Failed to generate playlist."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="playlist-modal__overlay">
      <div
        className="playlist-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-ai-playlist-title"
      >
        <div className="playlist-modal__header">
          <h2 id="generate-ai-playlist-title" className="playlist-modal__title">
            Generate with AI
          </h2>
          <p className="playlist-modal__subtitle">
            Describe a vibe, activity, or listening goal and a playlist will be
            created for you.
          </p>
        </div>

        <form className="playlist-modal__form" onSubmit={handleSubmit}>
          <div className="playlist-modal__field">
            <label className="playlist-modal__label" htmlFor="ai-playlist-prompt">
              Prompt
            </label>

            <textarea
              id="ai-playlist-prompt"
              className="playlist-modal__input playlist-modal__textarea"
              value={prompt}
              placeholder="Example: upbeat late-night electronic tracks for studying"
              rows={5}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={saving}
            />
          </div>

          {error && (
            <p className="playlist-modal__error" role="alert">
              {error}
            </p>
          )}

          {saving && (
            <p className="playlist-modal__helper" aria-live="polite">
              Generating playlist...
            </p>
          )}

          <div className="playlist-modal__actions">
            <button
              type="button"
              className="playlist-modal__button playlist-modal__button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="playlist-modal__button playlist-modal__button--primary"
              disabled={saving}
            >
              {saving ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
