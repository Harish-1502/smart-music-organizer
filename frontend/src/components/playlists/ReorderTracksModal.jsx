import { useState } from 'react';
import { reorderPlaylist } from '../../api/playlistApi';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "../../styles/playlist/ReorderPlaylistModal.css";

function SortableTrackRow({ track }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: track.playlist_track_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="reorder-track-row"
      {...attributes}
      {...listeners}
    >
      <span className="reorder-track-row__handle" aria-hidden="true"></span>

      <div className="reorder-track-row__content">
        <strong className="reorder-track-row__title">{track.title}</strong>
        <span className="reorder-track-row__meta">
          {track.artist || "Unknown Artist"}
        </span>
      </div>
    </div>
  );
}

export default function ReorderTracksModal({ playlistId, tracks, onClose, onReorder }) {
    const [trackOrder, setTrackOrder] = useState(tracks);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const sensors = useSensors(useSensor(PointerSensor));

    function handleDragEnd(event) {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        setTrackOrder((prev) => {
            const oldIndex = prev.findIndex(
                (track) => track.playlist_track_id === active.id
        );

            const newIndex = prev.findIndex(
                (track) => track.playlist_track_id === over.id
        );

            return arrayMove(prev, oldIndex, newIndex);
        });
    }

    async function handleSave() {
        setSaving(true);
        setMessage("");

        try {
            const playlistTrackIds = trackOrder.map(
                (track) => track.playlist_track_id
            );

            await reorderPlaylist(playlistId, playlistTrackIds);

            onReorder(
                trackOrder.map((track, index) => ({
                    ...track,
                    position: index + 1,
                }))
            );
            onClose();
        } catch (error) {
            setMessage("Failed to reorder tracks.");
        } finally {
            setSaving(false);
        }
    }

  return (
    <div className="reorder-modal-overlay">
    <div
      className="reorder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-modal-title"
      aria-describedby="reorder-modal-help"
    >
      <div className="reorder-modal__header">
        <h2 id="reorder-modal-title" className="reorder-modal__title">
          Reorder playlist
        </h2>
        <p id="reorder-modal-help" className="reorder-modal__subtitle">
          Drag tracks to change the sequence, then save the new order.
        </p>
      </div>

      {message && (
        <p className="reorder-modal-error" role="alert">
          {message}
        </p>
      )}

      <div className="reorder-modal__list-shell">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={trackOrder.map((t) => t.playlist_track_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="reorder-modal__track-list" aria-label="Tracks in playlist">
              {trackOrder.map((track) => (
                <SortableTrackRow
                  key={track.playlist_track_id}
                  track={track}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="reorder-modal-actions">
        <button
          type="button"
          className="reorder-modal__button reorder-modal__button--secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="button"
          className="reorder-modal__button reorder-modal__button--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Order"}
        </button>
      </div>
    </div>
  </div>
  );
}