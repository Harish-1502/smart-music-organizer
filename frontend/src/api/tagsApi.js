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

export async function getTagReferenceTracks(tagId) {
  const response = await api.get(`/tags/${tagId}/reference-tracks`);
  return response.data;
}

export async function addTagReferenceTrack(tagId, payload) {
  const response = await api.post(`/tags/${tagId}/reference-tracks`, payload);
  return response.data;
}

export async function removeTagReferenceTrack(tagId, trackId) {
  const response = await api.delete(`/tags/${tagId}/reference-tracks`, {
    params: { track_id: trackId },
  });
  return response.data;
}

export async function getReferenceSuggestions(
  tagId,
  { limit = 25, minScore = 0.65 } = {}
) {
  const response = await api.get(`/tags/${tagId}/reference-suggestions`, {
    params: {
      limit,
      min_score: minScore,
    },
  });
  return response.data;
}

export async function getAllReferenceSuggestions({
  limit = 50,
  minScore = 0.65,
} = {}) {
  const response = await api.get("/reference-suggestions", {
    params: {
      limit,
      min_score: minScore,
    },
  });
  return response.data;
}

export async function acceptReferenceSuggestionsBatch(tagId, trackIds) {
  const response = await api.post(
    `/tags/${tagId}/reference-suggestions/accept-batch`,
    { track_ids: trackIds }
  );
  return response.data;
}

export async function rejectReferenceSuggestionsBatch(tagId, trackIds) {
  const response = await api.post(
    `/tags/${tagId}/reference-suggestions/reject-batch`,
    { track_ids: trackIds }
  );
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
