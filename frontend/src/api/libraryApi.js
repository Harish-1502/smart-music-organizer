import { api } from "./apiBase";

export async function scanLibrary(folderPath) {
  console.log("API CALL: scanLibrary");
  const res = await api.post("/library/scan", {
    folder_path: folderPath,
  });
  return res.data;
}

export async function getScanStatus() {
  console.log("API CALL: getScanStatus");
  const res = await api.get("/library/scan_status");
  return res.data;
}

export const CLEAR_LIBRARY_CONFIRMATION = "CLEAR LIBRARY";

export async function clearLibrary(confirm) {
  if (confirm !== CLEAR_LIBRARY_CONFIRMATION) {
    throw new Error("Confirmation is required to clear the library.");
  }

  console.log("API CALL: clearLibrary");
  const res = await api.delete("/library/clear", {
    data: { confirm },
  });
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

  const res = await api.get("/tracks", {
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
  const res = await api.get("/artists");
  return res.data;
}

export async function getAlbums() {
  const res = await api.get("/albums");
  return res.data;
}

export async function updateTrack(id, data) {
  const res = await api.patch(`/tracks/${id}`, data);
  return res.data;
}

export async function uploadTrackArt(trackId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(`/tracks/${trackId}/art`, formData);

  return response.data;
}
