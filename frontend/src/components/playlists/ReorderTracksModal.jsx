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
      <strong>{track.title}</strong>
      <span> — {track.artist || "Unknown Artist"}</span>
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
      <div className="reorder-modal">
        <h2>Reorder Playlist</h2>

        {message && <p className="reorder-modal-error">{message}</p>}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={trackOrder.map((t) => t.playlist_track_id)}
            strategy={verticalListSortingStrategy}
          >
            {trackOrder.map((track) => (
              <SortableTrackRow
                key={track.playlist_track_id}
                track={track}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className="reorder-modal-actions">
          <button onClick={onClose} disabled={saving}>
            Cancel
          </button>

          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Order"}
          </button>
        </div>
      </div>
    </div>
  );
}