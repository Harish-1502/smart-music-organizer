import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export async function scanLibrary(folderPath) {
  console.log("API CALL: scanLibrary");
  const res = await axios.post(`${API_BASE}/library/scan`, {
    folder_path: folderPath,
  });
  return res.data;
}

export async function getScanStatus() {
  console.log("API CALL: getScanStatus");
  const res = await axios.get(`${API_BASE}/library/scan_status`);
  return res.data;
}

export async function clearLibrary() {
  console.log("API CALL: clearLibrary");
  const res = await axios.delete(`${API_BASE}/library/clear`);
  return res.data;
}

export async function getTracks(
  page = 1, 
  pageSize = 25, 
  search,
  sort_By = "title",
  order = "asc",
  artist = "",
  exactArtist = "",
  album = "",
  exactAlbum = "",
  extension = "") {
  // console.log("API CALL: getTracks", { page, pageSize });
  // console.log("Current Exact Artist Filter from API:", exactArtist);

  const res = await axios.get(`${API_BASE}/tracks`, {
    params: {
      search: (search || "").trim() || undefined,
      sort_by: sort_By,
      order: order,
      artist: artist || undefined,
      album: album || undefined,
      exact_artist: exactArtist || undefined,
      exact_album: exactAlbum || undefined,
      extension: extension || undefined,
      page,
      page_size: pageSize,
    },
  });
  return res.data;
}

export async function getArtists() {
  const res = await axios.get(`${API_BASE}/artists`);
  return res.data;
}

export async function getAlbums() {
  const res = await axios.get(`${API_BASE}/albums`);
  return res.data;
}

export async function updateTrack(id, data) {
  const res = await axios.patch(`${API_BASE}/tracks/${id}`, data);
  return res.data;
}

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

export async function uploadTrackArt(trackId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(
    `${API_BASE}/tracks/${trackId}/art`,
    formData
  );

  return response.data;
}