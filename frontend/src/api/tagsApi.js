import { api } from "./apiBase";

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

// export async function getTrackTagSuggestions(trackId) {
//   const response = await api.get(`/tracks/${trackId}/tag-suggestions`);
//   return response.data;
// }

// export async function refreshTrackTagSuggestions(trackId) {
//   const response = await api.post(`/tracks/${trackId}/tag-suggestions/refresh`);
//   return response.data;
// }

// export async function acceptTrackTagSuggestion(trackId, suggestionId) {
//   const response = await api.post(
//     `/tracks/${trackId}/tag-suggestions/${suggestionId}/accept`
//   );
//   return response.data;
// }

// export async function rejectTrackTagSuggestion(trackId, suggestionId) {
//   const response = await api.post(
//     `/tracks/${trackId}/tag-suggestions/${suggestionId}/reject`
//   );
//   return response.data;
// }
