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
  album = "",
  extension = "") {
  console.log("API CALL: getTracks", { page, pageSize });
  const res = await axios.get(`${API_BASE}/tracks`, {
    params: {
      search: search.trim() || undefined,
      sort_by: sort_By,
      order: order,
      artist: artist || undefined,
      album: album || undefined,
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