import { useRef, useState } from "react";
import { updateTrack, uploadTrackArt } from "../api/libraryApi";
import {
  addTagToTrack,
  createTag,
  getTags,
  getTrackTags,
  removeTagFromTrack,
} from "../api/tagsApi";

export default function useTrackEdit({ loadTracks, setMessage }) {
  const [editStatus, setEditStatus] = useState("idle");
  const [showModal, setShowModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    artist: "",
    album: "",
  });
  const [selectedArtFile, setSelectedArtFile] = useState(null);
  const [artPreviewUrl, setArtPreviewUrl] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [trackTags, setTrackTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [tagActionLoading, setTagActionLoading] = useState(false);
  const [newTagForm, setNewTagForm] = useState({
    name: "",
    category: "",
  });
  const tagRequestIdRef = useRef(0);

  function sortTags(tags) {
    return [...tags].sort((a, b) => {
      const categoryCompare = (a.category || "").localeCompare(
        b.category || "",
      );

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return (a.name || "").localeCompare(b.name || "");
    });
  }

  async function loadTagData(trackId) {
    if (!trackId) {
      setAllTags([]);
      setTrackTags([]);
      setTagsLoading(false);
      setTagsError("");
      return;
    }

    const requestId = tagRequestIdRef.current + 1;
    tagRequestIdRef.current = requestId;
    setTagsLoading(true);
    setTagsError("");

    try {
      const [tags, attachedTags] = await Promise.all([
        getTags(),
        getTrackTags(trackId),
      ]);

      if (tagRequestIdRef.current !== requestId) {
        return;
      }

      setAllTags(tags || []);
      setTrackTags(attachedTags || []);
    } catch (error) {
      if (tagRequestIdRef.current !== requestId) {
        return;
      }

      setAllTags([]);
      setTrackTags([]);
      setTagsError(error.message || "Failed to load tags");
    } finally {
      if (tagRequestIdRef.current === requestId) {
        setTagsLoading(false);
      }
    }
  }

  function handleEditTrack(track) {
    setEditStatus("editing");
    setSelectedTrack(track);
    setEditForm({
      title: track.display_title || "",
      artist: track.display_artist || "",
      album: track.display_album || "",
    });
    
    setArtPreviewUrl(track.art_path || "");
    setSelectedArtFile(null);
    setSelectedTagId("");
    setNewTagForm({
      name: "",
      category: "",
    });
    setShowModal(true);
    loadTagData(track.id);
  }

  function handleArtFileChange(file) {
    if (!file) return;

    setSelectedArtFile(file);
    setArtPreviewUrl(URL.createObjectURL(file));
  }

  function handleFormChange(field, value) {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleCancelEdit() {
    tagRequestIdRef.current += 1;
    setShowModal(false);
    setSelectedTrack(null);
    setEditStatus("idle");
    setEditForm({
      title: "",
      artist: "",
      album: "",
    });
    setSelectedArtFile(null);
    setArtPreviewUrl("");
    setAllTags([]);
    setTrackTags([]);
    setTagsLoading(false);
    setTagsError("");
    setSelectedTagId("");
    setTagActionLoading(false);
    setNewTagForm({
      name: "",
      category: "",
    });
  }

  function handleSelectedTagChange(value) {
    setSelectedTagId(value);
  }

  function handleNewTagChange(field, value) {
    setNewTagForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleAddTag() {
    if (!selectedTrack?.id || !selectedTagId) {
      return;
    }

    const nextTagId = Number(selectedTagId);

    if (trackTags.some((tag) => tag.tag_id === nextTagId)) {
      setTagsError("Track already has this tag.");
      return;
    }

    setTagActionLoading(true);
    setTagsError("");

    try {
      const attachedTag = await addTagToTrack(selectedTrack.id, nextTagId);
      setTrackTags((prev) => [...prev, attachedTag]);
      setSelectedTagId("");
    } catch (error) {
      setTagsError(error.message || "Failed to add tag");
    } finally {
      setTagActionLoading(false);
    }
  }

  async function handleRemoveTag(tagId) {
    if (!selectedTrack?.id || !tagId) {
      return;
    }

    setTagActionLoading(true);
    setTagsError("");

    try {
      await removeTagFromTrack(selectedTrack.id, tagId);
      setTrackTags((prev) => prev.filter((tag) => tag.tag_id !== tagId));
    } catch (error) {
      setTagsError(error.message || "Failed to remove tag");
    } finally {
      setTagActionLoading(false);
    }
  }

  async function handleCreateTag() {
    if (!selectedTrack?.id) {
      return;
    }

    const name = newTagForm.name.trim();
    const category = newTagForm.category.trim();

    if (!name || !category) {
      setTagsError("Tag name and category are required.");
      return;
    }

    setTagActionLoading(true);
    setTagsError("");

    try {
      const createdTag = await createTag({ name, category });

      setAllTags((prev) =>
        sortTags([
          ...prev.filter((tag) => tag.id !== createdTag.id),
          createdTag,
        ]),
      );

      try {
        const attachedTag = await addTagToTrack(selectedTrack.id, createdTag.id);
        setTrackTags((prev) => [...prev, attachedTag]);
        setSelectedTagId("");
        setNewTagForm({
          name: "",
          category: "",
        });
      } catch (error) {
        setSelectedTagId(String(createdTag.id));
        setTagsError(
          error.message || "Tag created, but failed to attach it to this track.",
        );
      }
    } catch (error) {
      setTagsError(error.message || "Failed to create tag");
    } finally {
      setTagActionLoading(false);
    }
  }

  async function handleSaveEdit() {
    try {
      setEditStatus("saving");
      await updateTrack(selectedTrack.id, editForm);

      if (selectedArtFile) {
        await uploadTrackArt(selectedTrack.id, selectedArtFile);
      }
      setMessage("Track updated successfully");

      setShowModal(false);
      setSelectedTrack(null);
      setEditStatus("idle");
      setEditForm({
        title: "",
        artist: "",
        album: "",
      });
      setSelectedArtFile(null);
      setArtPreviewUrl("");

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
    selectedArtFile,
    artPreviewUrl,
    allTags,
    trackTags,
    tagsLoading,
    tagsError,
    selectedTagId,
    tagActionLoading,
    newTagForm,
    handleEditTrack,
    handleFormChange,
    handleArtFileChange,
    handleSelectedTagChange,
    handleNewTagChange,
    handleAddTag,
    handleRemoveTag,
    handleCreateTag,
    handleCancelEdit,
    handleSaveEdit,
  };
}
