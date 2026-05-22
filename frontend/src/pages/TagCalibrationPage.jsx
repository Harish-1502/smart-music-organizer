import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../api/apiErrors";
import { getTracks } from "../api/libraryApi";
import {
  acceptReferenceSuggestionsBatch,
  addTagReferenceTrack,
  getAllReferenceSuggestions,
  getTagReferenceTracks,
  getTags,
  rejectReferenceSuggestionsBatch,
  removeTagReferenceTrack,
} from "../api/tagsApi";
import "../styles/TagCalibrationPage.css";

function trackTitle(track) {
  return (
    track?.track_title ||
    track?.display_title ||
    track?.title ||
    track?.scanned_title ||
    track?.file_name ||
    "Untitled track"
  );
}

function trackArtist(track) {
  return (
    track?.track_artist ||
    track?.display_artist ||
    track?.artist ||
    track?.scanned_artist ||
    "Unknown artist"
  );
}

function trackFileName(track) {
  return track?.track_file_name || track?.file_name || "";
}

function scoreLabel(value) {
  if (typeof value !== "number") return "-";
  return value.toFixed(2);
}

function suggestionKey(suggestion) {
  return `${suggestion.tag_id}:${suggestion.track_id}`;
}

function groupTrackIdsByTag(suggestions) {
  return suggestions.reduce((groups, suggestion) => {
    const tagId = suggestion.tag_id;
    const currentTrackIds = groups.get(tagId) || [];
    groups.set(tagId, [...currentTrackIds, suggestion.track_id]);
    return groups;
  }, new Map());
}

function matchedReferenceLabel(match) {
  if (!match) return "";

  const title = trackTitle(match);
  const score =
    typeof match.similarity === "number" ? ` (${match.similarity.toFixed(2)})` : "";

  return `${title}${score}`;
}

function suggestionReasonLines(suggestion) {
  const closestPositive = suggestion.positive_matches?.[0];
  const closestNegative = suggestion.negative_matches?.[0];
  const lines = [];

  if (closestPositive) {
    lines.push(`Closest positive: ${matchedReferenceLabel(closestPositive)}`);
  }

  if (closestNegative) {
    lines.push(`Closest negative: ${matchedReferenceLabel(closestNegative)}`);
  }

  return lines.length ? lines : suggestion.reasons || [];
}

export default function TagCalibrationPage() {
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [reviewTagFilter, setReviewTagFilter] = useState("");
  const [tracks, setTracks] = useState([]);
  const [selectedLibraryTrackIds, setSelectedLibraryTrackIds] = useState([]);
  const [references, setReferences] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState([]);
  const [reviewSearch, setReviewSearch] = useState("");
  const [trackSearch, setTrackSearch] = useState("");
  const [appliedTrackSearch, setAppliedTrackSearch] = useState("");
  const [trackPage, setTrackPage] = useState(1);
  const [trackPageSize, setTrackPageSize] = useState(10);
  const [trackTotal, setTrackTotal] = useState(0);
  const [minScore, setMinScore] = useState("0.65");
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedTag = useMemo(
    () => tags.find((tag) => String(tag.id) === String(selectedTagId)),
    [selectedTagId, tags]
  );

  const selectedSuggestions = useMemo(() => {
    const selectedKeys = new Set(selectedSuggestionKeys);
    return suggestions.filter((suggestion) =>
      selectedKeys.has(suggestionKey(suggestion))
    );
  }, [selectedSuggestionKeys, suggestions]);

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = reviewSearch.trim().toLowerCase();

    return suggestions.filter((suggestion) => {
      const matchesTag =
        !reviewTagFilter || String(suggestion.tag_id) === reviewTagFilter;

      if (!matchesTag) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        trackTitle(suggestion),
        trackArtist(suggestion),
        trackFileName(suggestion),
        suggestion.tag_name,
        ...(suggestion.reasons || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [reviewSearch, reviewTagFilter, suggestions]);

  const visibleSuggestionKeys = useMemo(
    () => filteredSuggestions.map((suggestion) => suggestionKey(suggestion)),
    [filteredSuggestions]
  );

  const allVisibleSuggestionsSelected =
    visibleSuggestionKeys.length > 0 &&
    visibleSuggestionKeys.every((key) => selectedSuggestionKeys.includes(key));

  const trackTotalPages = Math.max(1, Math.ceil(trackTotal / trackPageSize));

  const positiveReferences = references.filter(
    (reference) => reference.label === "positive"
  );
  const negativeReferences = references.filter(
    (reference) => reference.label === "negative"
  );

  async function loadTags() {
    try {
      const data = await getTags();
      setTags(data);

      if (!selectedTagId && data.length > 0) {
        setSelectedTagId(String(data[0].id));
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to load tags."));
    }
  }

  async function loadTracks() {
    setTracksLoading(true);

    try {
      const data = await getTracks(
        trackPage,
        trackPageSize,
        appliedTrackSearch,
        "title",
        "asc"
      );
      const trackItems = data.items || [];
      const total = Number(data.total);

      setTracks(trackItems);
      setTrackTotal(Number.isFinite(total) ? total : trackItems.length);
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to load tracks."));
    } finally {
      setTracksLoading(false);
    }
  }

  async function loadReferences(tagId = selectedTagId) {
    if (!tagId) {
      setReferences([]);
      return;
    }

    try {
      const data = await getTagReferenceTracks(tagId);
      setReferences(data);
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to load references."));
    }
  }

  async function refreshSuggestions() {
    setSuggestionsLoading(true);
    setSelectedSuggestionKeys([]);

    try {
      const parsedMinScore = Number.parseFloat(minScore);
      const data = await getAllReferenceSuggestions({
        limit: 50,
        minScore: Number.isFinite(parsedMinScore) ? parsedMinScore : 0.65,
      });
      setSuggestions(data);
      setMessage(data.length ? "" : "No suggestions found.");
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to load suggestions."));
    } finally {
      setSuggestionsLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
    refreshSuggestions();
  }, []);

  useEffect(() => {
    loadTracks();
  }, [appliedTrackSearch, trackPage, trackPageSize]);

  useEffect(() => {
    if (!selectedTagId) return;

    setSelectedLibraryTrackIds([]);
    loadReferences(selectedTagId);
  }, [selectedTagId]);

  function toggleLibraryTrack(trackId) {
    setSelectedLibraryTrackIds((current) =>
      current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId]
    );
  }

  function toggleSuggestion(suggestion) {
    const key = suggestionKey(suggestion);
    setSelectedSuggestionKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key]
    );
  }

  function toggleAllVisibleSuggestions() {
    if (allVisibleSuggestionsSelected) {
      setSelectedSuggestionKeys((current) =>
        current.filter((key) => !visibleSuggestionKeys.includes(key))
      );
      return;
    }

    setSelectedSuggestionKeys((current) =>
      Array.from(new Set([...current, ...visibleSuggestionKeys]))
    );
  }

  async function addReferences(label) {
    if (!selectedTagId || selectedLibraryTrackIds.length === 0) return;

    setLoading(true);
    setMessage("");

    try {
      await Promise.all(
        selectedLibraryTrackIds.map((trackId) =>
          addTagReferenceTrack(selectedTagId, {
            track_id: trackId,
            label,
            source: "manual_reference",
          })
        )
      );
      setSelectedLibraryTrackIds([]);
      await loadReferences(selectedTagId);
      await refreshSuggestions();
      setMessage(
        label === "positive"
          ? "Positive references added."
          : "Negative references added."
      );
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to add references."));
    } finally {
      setLoading(false);
    }
  }

  async function removeReference(reference) {
    setLoading(true);
    setMessage("");

    try {
      await removeTagReferenceTrack(reference.tag_id, reference.track_id);
      await loadReferences(reference.tag_id);
      await refreshSuggestions();
      setMessage("Reference removed.");
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to remove reference."));
    } finally {
      setLoading(false);
    }
  }

  async function applySuggestionAction(action, suggestionsToUpdate) {
    if (suggestionsToUpdate.length === 0) return;

    setLoading(true);
    setMessage("");

    try {
      const groups = groupTrackIdsByTag(suggestionsToUpdate);
      const requests = Array.from(groups.entries()).map(([tagId, trackIds]) =>
        action === "accept"
          ? acceptReferenceSuggestionsBatch(tagId, trackIds)
          : rejectReferenceSuggestionsBatch(tagId, trackIds)
      );

      await Promise.all(requests);
      setSelectedSuggestionKeys([]);

      if (selectedTagId) {
        await loadReferences(selectedTagId);
      }

      await refreshSuggestions();
      setMessage(
        action === "accept"
          ? "Selected suggestions accepted."
          : "Selected suggestions rejected."
      );
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to update suggestions."));
    } finally {
      setLoading(false);
    }
  }

  function handleTrackSearchSubmit(event) {
    event.preventDefault();
    setTrackPage(1);
    setAppliedTrackSearch(trackSearch.trim());
  }

  return (
    <main className="tag-calibration" aria-labelledby="tag-calibration-title">
      <div className="tag-calibration__inner">
        <header className="tag-calibration__header">
          <div>
            <p className="tag-calibration__eyebrow">AI review</p>
            <h1 id="tag-calibration-title" className="tag-calibration__title">
              Reference Suggestions
            </h1>
          </div>

          <div className="tag-calibration__header-actions">
            <label className="tag-calibration__field tag-calibration__field--inline">
              <span className="tag-calibration__label">Min score</span>
              <input
                className="tag-calibration__input tag-calibration__input--score"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={minScore}
                onChange={(event) => setMinScore(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="tag-calibration__button tag-calibration__button--primary"
              onClick={refreshSuggestions}
              disabled={suggestionsLoading}
            >
              {suggestionsLoading ? "Refreshing..." : "Refresh Suggestions"}
            </button>
          </div>
        </header>

        {message ? (
          <p className="tag-calibration__message" role="status">
            {message}
          </p>
        ) : null}

        <section
          className="tag-calibration__panel tag-calibration__panel--review"
          aria-labelledby="suggestion-review-title"
        >
          <div className="tag-calibration__panel-header">
            <div>
              <h2 id="suggestion-review-title">Suggestion Review</h2>
              <p>
                {filteredSuggestions.length} visible,{" "}
                {selectedSuggestionKeys.length} selected
              </p>
            </div>

            <div className="tag-calibration__filters">
              <label className="tag-calibration__field">
                <span className="tag-calibration__label">Search</span>
                <input
                  className="tag-calibration__input"
                  type="search"
                  placeholder="Track, artist, file, tag, reason"
                  value={reviewSearch}
                  onChange={(event) => setReviewSearch(event.target.value)}
                />
              </label>

              <label className="tag-calibration__field">
                <span className="tag-calibration__label">Tag</span>
                <select
                  className="tag-calibration__select"
                  value={reviewTagFilter}
                  onChange={(event) => setReviewTagFilter(event.target.value)}
                >
                  <option value="">All tags</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="tag-calibration__actions">
            <button
              type="button"
              className="tag-calibration__button"
              onClick={() => applySuggestionAction("accept", selectedSuggestions)}
              disabled={loading || selectedSuggestions.length === 0}
            >
              Accept Selected
            </button>
            <button
              type="button"
              className="tag-calibration__button"
              onClick={() => applySuggestionAction("reject", selectedSuggestions)}
              disabled={loading || selectedSuggestions.length === 0}
            >
              Reject Selected
            </button>
          </div>

          {suggestionsLoading ? (
            <p className="tag-calibration__state">Loading suggestions...</p>
          ) : filteredSuggestions.length === 0 ? (
            <p className="tag-calibration__state">No suggestions to review.</p>
          ) : (
            <div className="tag-calibration__table-wrap tag-calibration__suggestion-table-scroll">
              <table className="tag-calibration__table tag-calibration__table--review">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allVisibleSuggestionsSelected}
                        onChange={toggleAllVisibleSuggestions}
                        aria-label="Select all visible suggestions"
                      />
                    </th>
                    <th>Track</th>
                    <th>Artist</th>
                    <th>Tag</th>
                    <th>Score</th>
                    <th>Reasons</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuggestions.map((suggestion) => {
                    const key = suggestionKey(suggestion);
                    const isSelected = selectedSuggestionKeys.includes(key);
                    const title = trackTitle(suggestion);
                    const artist = trackArtist(suggestion);
                    const fileName = trackFileName(suggestion);
                    const reasonsText = (suggestion.reasons || []).join(" - ");
                    const reasonLines = suggestionReasonLines(suggestion);
                    const reasonTooltip = [
                      ...reasonLines,
                      ...(suggestion.reasons || []),
                    ].join(" - ");

                    return (
                      <tr key={key}>
                        <td data-label="Select">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSuggestion(suggestion)}
                            aria-label={`Select ${trackTitle(
                              suggestion
                            )} for ${suggestion.tag_name}`}
                          />
                        </td>
                        <td data-label="Track">
                          <div className="tag-calibration__track-cell">
                            <span
                              className="tag-calibration__track-title"
                              title={title}
                            >
                              {title}
                            </span>
                            {fileName ? (
                              <span
                                className="tag-calibration__track-file"
                                title={fileName}
                              >
                                {fileName}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td data-label="Artist">
                          <span
                            className="tag-calibration__artist-text"
                            title={artist}
                          >
                            {artist}
                          </span>
                        </td>
                        <td data-label="Tag">
                          <span className="tag-calibration__tag-pill">
                            {suggestion.tag_name}
                          </span>
                        </td>
                        <td data-label="Score">
                          <span className="tag-calibration__score">
                            {scoreLabel(suggestion.final_score)}
                          </span>
                        </td>
                        <td data-label="Reasons">
                          <div
                            className="tag-calibration__suggestion-reason-scroll"
                            title={reasonTooltip}
                          >
                            {reasonLines.map((line) => (
                              <span
                                key={line}
                                className="tag-calibration__reason-line"
                              >
                                {line}
                              </span>
                            ))}
                            {reasonsText ? (
                              <span className="tag-calibration__reason-detail">
                                {reasonsText}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td data-label="Actions">
                          <div className="tag-calibration__row-actions">
                            <button
                              type="button"
                              className="tag-calibration__button tag-calibration__button--compact"
                              onClick={() =>
                                applySuggestionAction("accept", [suggestion])
                              }
                              disabled={loading}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="tag-calibration__button tag-calibration__button--compact"
                              onClick={() =>
                                applySuggestionAction("reject", [suggestion])
                              }
                              disabled={loading}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <details className="tag-calibration__details">
          <summary className="tag-calibration__details-summary">
            Manage Reference Tracks
          </summary>

          <div className="tag-calibration__details-body">
            <section
              className="tag-calibration__panel"
              aria-labelledby="reference-tag-title"
            >
              <div className="tag-calibration__panel-header">
                <div>
                  <h2 id="reference-tag-title">Reference Tag</h2>
                  <p>{selectedTag?.name || "Choose a tag"}</p>
                </div>

                <label className="tag-calibration__field">
                  <span className="tag-calibration__label">Tag</span>
                  <select
                    className="tag-calibration__select"
                    value={selectedTagId}
                    onChange={(event) => setSelectedTagId(event.target.value)}
                  >
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name} ({tag.category})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section
              className="tag-calibration__panel"
              aria-labelledby="calibration-picker-title"
            >
              <div className="tag-calibration__panel-header">
                <div>
                  <h2 id="calibration-picker-title">Library Tracks</h2>
                  <p>{selectedLibraryTrackIds.length} selected</p>
                </div>

                <form
                  className="tag-calibration__search"
                  onSubmit={handleTrackSearchSubmit}
                >
                  <input
                    className="tag-calibration__input"
                    type="search"
                    placeholder="Search tracks"
                    value={trackSearch}
                    onChange={(event) => setTrackSearch(event.target.value)}
                  />
                  <button type="submit" className="tag-calibration__button">
                    Search
                  </button>
                </form>
              </div>

              <div className="tag-calibration__actions">
                <button
                  type="button"
                  className="tag-calibration__button tag-calibration__button--primary"
                  onClick={() => addReferences("positive")}
                  disabled={
                    loading ||
                    !selectedTagId ||
                    selectedLibraryTrackIds.length === 0
                  }
                >
                  Add Positive
                </button>
                <button
                  type="button"
                  className="tag-calibration__button"
                  onClick={() => addReferences("negative")}
                  disabled={
                    loading ||
                    !selectedTagId ||
                    selectedLibraryTrackIds.length === 0
                  }
                >
                  Add Negative
                </button>
              </div>

              {tracksLoading ? (
                <p className="tag-calibration__state">Loading tracks...</p>
              ) : (
                <>
                  <div className="tag-calibration__table-wrap tag-calibration__library-table-scroll">
                    <table className="tag-calibration__table tag-calibration__table--library">
                      <thead>
                        <tr>
                          <th>Select</th>
                          <th>Title</th>
                          <th>Artist</th>
                          <th>File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tracks.length === 0 ? (
                          <tr>
                            <td colSpan="4">No tracks found.</td>
                          </tr>
                        ) : (
                          tracks.map((track) => (
                            <tr key={track.id}>
                              <td data-label="Select">
                                <input
                                  type="checkbox"
                                  checked={selectedLibraryTrackIds.includes(
                                    track.id
                                  )}
                                  onChange={() => toggleLibraryTrack(track.id)}
                                />
                              </td>
                              <td data-label="Title" title={trackTitle(track)}>
                                {trackTitle(track)}
                              </td>
                              <td data-label="Artist" title={trackArtist(track)}>
                                {trackArtist(track)}
                              </td>
                              <td data-label="File" title={trackFileName(track)}>
                                {trackFileName(track)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="tag-calibration__pagination">
                    <button
                      type="button"
                      className="tag-calibration__button tag-calibration__button--compact"
                      onClick={() =>
                        setTrackPage((currentPage) =>
                          Math.max(1, currentPage - 1)
                        )
                      }
                      disabled={tracksLoading || trackPage <= 1}
                    >
                      Previous
                    </button>
                    <span className="tag-calibration__pagination-label">
                      Page {trackPage} of {trackTotalPages}
                    </span>
                    <button
                      type="button"
                      className="tag-calibration__button tag-calibration__button--compact"
                      onClick={() =>
                        setTrackPage((currentPage) =>
                          Math.min(trackTotalPages, currentPage + 1)
                        )
                      }
                      disabled={tracksLoading || trackPage >= trackTotalPages}
                    >
                      Next
                    </button>

                    <label className="tag-calibration__field tag-calibration__field--inline tag-calibration__pagination-size">
                      <span className="tag-calibration__label">Rows</span>
                      <select
                        className="tag-calibration__select"
                        value={trackPageSize}
                        onChange={(event) => {
                          setTrackPageSize(Number(event.target.value));
                          setTrackPage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
            </section>

            <section
              className="tag-calibration__reference-sections"
              aria-label={`${selectedTag?.name || "Tag"} references`}
            >
              <ReferenceList
                title="Positive"
                references={positiveReferences}
                onRemove={removeReference}
                disabled={loading}
              />
              <ReferenceList
                title="Negative"
                references={negativeReferences}
                onRemove={removeReference}
                disabled={loading}
              />
            </section>
          </div>
        </details>
      </div>
    </main>
  );
}

function ReferenceList({ title, references, onRemove, disabled }) {
  return (
    <section className="tag-calibration__reference-panel">
      <div className="tag-calibration__reference-panel-header">
        <h2>{title}</h2>
        <p>{references.length} tracks</p>
      </div>

      <div className="tag-calibration__reference-list">
        {references.length === 0 ? (
          <p className="tag-calibration__state">
            No {title.toLowerCase()} tracks.
          </p>
        ) : (
          references.map((reference) => (
            <div
              key={reference.id}
              className="tag-calibration__reference-row"
            >
              <div className="tag-calibration__reference-main">
                <strong title={trackTitle(reference)}>
                  {trackTitle(reference)}
                </strong>
                <span
                  title={`${trackArtist(reference)} - ${trackFileName(
                    reference
                  )}`}
                >
                  {trackArtist(reference)} - {trackFileName(reference)}
                </span>
              </div>
              <button
                type="button"
                className="tag-calibration__button tag-calibration__button--compact"
                onClick={() => onRemove(reference)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
