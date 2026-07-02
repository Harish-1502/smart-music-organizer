import { maskTrack } from "../../utils/demoMode";

export default function TrackTable({
  tracks,
  onEdit,
  mode = "library",
  selectedTrackIds = [],
  onToggleTrack,
  onPlayTrack,
}) {
  return (
    <table className={`track-table track-table--${mode}`}>
      <thead className="track-table__head">
        <tr className="track-table__head-row">
          {mode === "picker" && (
            <th
              scope="col"
              className="track-table__head-cell track-table__head-cell--select"
            >
              Select
            </th>
          )}
          <th scope="col" className="track-table__head-cell">
            Title
          </th>
          <th scope="col" className="track-table__head-cell">
            Artist
          </th>
          <th scope="col" className="track-table__head-cell">
            Album
          </th>
          <th
            scope="col"
            className="track-table__head-cell track-table__head-cell--duration"
          >
            Duration
          </th>
          <th scope="col" className="track-table__head-cell">
            File Name
          </th>
          {mode === "library" && (
            <th
              scope="col"
              className="track-table__head-cell track-table__head-cell--actions"
            >
              Actions
            </th>
          )}
        </tr>
      </thead>

      <tbody className="track-table__body">
        {tracks.map((track, index) => {
          const isPlayable = typeof onPlayTrack === "function";
          const displayTrack = maskTrack(track, index);

          function handlePlay() {
            onPlayTrack(track, index);
          }

          return (
            <tr
              key={track.id}
              className={`track-table__row${
                isPlayable ? " track-table__row--interactive" : ""
              }`}
              onClick={isPlayable ? handlePlay : undefined}
              onKeyDown={
                isPlayable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handlePlay();
                      }
                    }
                  : undefined
              }
              tabIndex={isPlayable ? 0 : undefined}
              role={isPlayable ? "button" : undefined}
              aria-label={isPlayable ? `Play ${displayTrack.title}` : undefined}
            >
              {mode === "picker" && (
                <td
                  className="track-table__cell track-table__cell--select"
                  data-label="Select"
                >
                  <input
                    className="track-table__checkbox"
                    type="checkbox"
                    checked={selectedTrackIds.includes(track.id)}
                    onChange={() => onToggleTrack(track.id)}
                  />
                </td>
              )}

              <td
                className="track-table__cell track-table__cell--title"
                data-label="Title"
              >
                <span className="track-table__text track-table__text--primary">
                  {displayTrack.title}
                </span>
              </td>

              <td
                className="track-table__cell track-table__cell--artist"
                data-label="Artist"
              >
                <span className="track-table__text track-table__text--secondary">
                  {displayTrack.artist || "-"}
                </span>
              </td>

              <td
                className="track-table__cell track-table__cell--album"
                data-label="Album"
              >
                <span className="track-table__text track-table__text--secondary">
                  {displayTrack.album || "-"}
                </span>
              </td>

              <td
                className="track-table__cell track-table__cell--duration"
                data-label="Duration"
              >
                <span className="track-table__text track-table__text--duration">
                  {track.durationLabel ?? track.duration ?? "-"}
                </span>
              </td>

              <td
                className="track-table__cell track-table__cell--filename"
                data-label="File Name"
              >
                <span className="track-table__text track-table__text--secondary">
                  {displayTrack.file_name}
                </span>
              </td>

              {mode === "library" && (
                <td
                  className="track-table__cell track-table__cell--actions"
                  data-label="Actions"
                >
                  <button
                    type="button"
                    className="track-table__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(track);
                    }}
                    aria-label={`Edit ${displayTrack.title}`}
                  >
                    Edit
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
