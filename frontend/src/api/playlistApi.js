import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export async function getPlaylists() {
  const response = await axios.get(`${API_BASE}/playlists`);
  return response.data;
}

export async function createPlaylist(name) {
  const response = await axios.post(`${API_BASE}/playlists`, { name });
  return response.data;
}

export async function renamePlaylist(playlistId, name) {
  const response = await axios.patch(`${API_BASE}/playlists/${playlistId}`, {
    name,
  });
  return response.data;
}

export async function deletePlaylist(playlistId) {
  const response = await axios.delete(`${API_BASE}/playlists/${playlistId}`);
  return response.data;
}

export async function getPlaylistDetail(playlistId) {
  const response = await axios.get(`${API_BASE}/playlists/${playlistId}`);
  return response.data;
}

export async function addTrackToPlaylist(playlistId, trackId) {
  const response = await axios.post(`${API_BASE}/playlists/${playlistId}/tracks`, {
    track_id: trackId,
  });
  return response.data;
}

export async function removeTrackFromPlaylist(playlistId, playlistTrackId) {
  const response = await axios.delete(
    `${API_BASE}/playlists/${playlistId}/tracks/${playlistTrackId}`
  );
  return response.data;
}

export async function reorderPlaylist(playlistId, playlistTrackIds) {
  const response = await axios.patch(`${API_BASE}/playlists/${playlistId}/reorder`, {
    playlist_track_ids: playlistTrackIds,
  });
  return response.data;
}

export async function generateAiPlaylist(prompt) {
  const response = await axios.post(`${API_BASE}/ai_playlists/generate`, {
    prompt,
  });
  return response.data;
}
