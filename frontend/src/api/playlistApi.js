import axios from "axios";
import { apiUrl } from "./apiBase";

export async function getPlaylists() {
  const response = await axios.get(apiUrl("/playlists"));
  return response.data;
}

export async function createPlaylist(name) {
  const response = await axios.post(apiUrl("/playlists"), { name });
  return response.data;
}

export async function renamePlaylist(playlistId, name) {
  const response = await axios.patch(apiUrl(`/playlists/${playlistId}`), {
    name,
  });
  return response.data;
}

export async function deletePlaylist(playlistId) {
  const response = await axios.delete(apiUrl(`/playlists/${playlistId}`));
  return response.data;
}

export async function getPlaylistDetail(playlistId) {
  const response = await axios.get(apiUrl(`/playlists/${playlistId}`));
  return response.data;
}

export async function addTrackToPlaylist(playlistId, trackId) {
  const response = await axios.post(apiUrl(`/playlists/${playlistId}/tracks`), {
    track_id: trackId,
  });
  return response.data;
}

export async function removeTrackFromPlaylist(playlistId, playlistTrackId) {
  const response = await axios.delete(
    apiUrl(`/playlists/${playlistId}/tracks/${playlistTrackId}`)
  );
  return response.data;
}

export async function reorderPlaylist(playlistId, playlistTrackIds) {
  const response = await axios.patch(apiUrl(`/playlists/${playlistId}/reorder`), {
    playlist_track_ids: playlistTrackIds,
  });
  return response.data;
}

export async function generateAiPlaylist(prompt) {
  const response = await axios.post(apiUrl("/ai_playlists/generate"), {
    prompt,
  });
  return response.data;
}
