import { api } from "./apiBase";

export async function getPlaylists() {
  const response = await api.get("/playlists");
  return response.data;
}

export async function createPlaylist(name) {
  const response = await api.post("/playlists", { name });
  return response.data;
}

export async function renamePlaylist(playlistId, name) {
  const response = await api.patch(`/playlists/${playlistId}`, {
    name,
  });
  return response.data;
}

export async function deletePlaylist(playlistId) {
  const response = await api.delete(`/playlists/${playlistId}`);
  return response.data;
}

export async function getPlaylistDetail(playlistId) {
  const response = await api.get(`/playlists/${playlistId}`);
  return response.data;
}

export async function addTrackToPlaylist(playlistId, trackId) {
  const response = await api.post(`/playlists/${playlistId}/tracks`, {
    track_id: trackId,
  });
  return response.data;
}

export async function removeTrackFromPlaylist(playlistId, playlistTrackId) {
  const response = await api.delete(
    `/playlists/${playlistId}/tracks/${playlistTrackId}`
  );
  return response.data;
}

export async function reorderPlaylist(playlistId, playlistTrackIds) {
  const response = await api.patch(`/playlists/${playlistId}/reorder`, {
    playlist_track_ids: playlistTrackIds,
  });
  return response.data;
}

export async function generateAiPlaylist(prompt) {
  const response = await api.post("/ai_playlists/generate", {
    prompt,
  });
  return response.data;
}
