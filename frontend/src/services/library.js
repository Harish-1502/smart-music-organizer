import axios from "axios";

const API_URL = "http://127.0.0.1:8000/library";

export async function scanLibrary(folderPath) {
  const response = await axios.post(`${API_URL}/scan`, {
    folder_path: folderPath,
  });
  return response.data;
}

export async function getScanStatus() {
  const response = await axios.get(`${API_URL}/scan_status`);
  return response.data;
}

export async function clearLibrary() {
  const response = await axios.delete(`${API_URL}/clear`);
  return response.data;
}

export async function getTracks() {
  const response = await axios.get(`${API_URL}/tracks`);
  return response.data;
}