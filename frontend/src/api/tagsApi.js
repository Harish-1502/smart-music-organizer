import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,
});

export async function getTags() {
  const response = await api.get("/tags");
  return response.data;
}

export async function createTag(payload) {
  const response = await api.post("/tags", payload);
  return response.data;
}

export async function getTrackTags(trackId) {
  const response = await api.get(`/tags/tracks/${trackId}`);
  return response.data;
}

export async function addTagToTrack(trackId, tagId) {
  const response = await api.post(`/tags/tracks/${trackId}`, {
    tag_id: tagId,
  });
  return response.data;
}

export async function removeTagFromTrack(trackId, tagId) {
  const response = await api.delete(`/tags/tracks/${trackId}/${tagId}`);
  return response.data;
}
