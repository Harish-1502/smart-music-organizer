import { useState } from "react";
import { updateTrack } from "../api/libraryApi";

export default function useTrackEdit({ loadTracks, setMessage }) {
  const [editStatus, setEditStatus] = useState("idle");
  const [showModal, setShowModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    artist: "",
    album: "",
  });

  function handleEditTrack(track) {
    setEditStatus("editing");
    setSelectedTrack(track);
    setEditForm({
      title: track.display_title || "",
      artist: track.display_artist || "",
      album: track.display_album || "",
    });
    setShowModal(true);
  }

  function handleFormChange(field, value) {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleCancelEdit() {
    setShowModal(false);
    setSelectedTrack(null);
    setEditStatus("idle");
    setEditForm({
      title: "",
      artist: "",
      album: "",
    });
  }

  async function handleSaveEdit() {
    try {
      setEditStatus("saving");
      await updateTrack(selectedTrack.id, editForm);
      setMessage("Track updated successfully");

      setShowModal(false);
      setSelectedTrack(null);
      setEditStatus("idle");
      setEditForm({
        title: "",
        artist: "",
        album: "",
      });

      await loadTracks();
    } catch (error) {
      setMessage(error.message || "Failed to update track");
      setEditStatus("idle");
    }
  }

  return {
    editStatus,
    showModal,
    selectedTrack,
    editForm,
    handleEditTrack,
    handleFormChange,
    handleCancelEdit,
    handleSaveEdit,
  };
}