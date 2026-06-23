import {
  createPlaylist,
  deletePlaylist,
  generateAiPlaylist,
  getPlaylistDetail,
  getPlaylists,
  removeTrackFromPlaylist,
  renamePlaylist,
} from "../api/playlistApi";

export const backendPlaylistSource = {
  kind: "backend",
  supportsCreate: true,
  supportsRename: true,
  supportsDelete: true,
  supportsTrackRemoval: true,
  supportsTrackEditing: true,
  supportsOfflineDownload: true,

  async getPlaylists() {
    return getPlaylists();
  },

  async getPlaylistDetail(playlistId) {
    return getPlaylistDetail(playlistId);
  },

  async createPlaylist(name) {
    return createPlaylist(name);
  },

  async renamePlaylist(playlistId, name) {
    return renamePlaylist(playlistId, name);
  },

  async deletePlaylist(playlistId) {
    return deletePlaylist(playlistId);
  },

  async removeTrackFromPlaylist(playlistId, playlistTrackId) {
    return removeTrackFromPlaylist(playlistId, playlistTrackId);
  },

  async generateAiPlaylist(prompt) {
    return generateAiPlaylist(prompt);
  },

  async buildPlaybackQueue(_playlistId, tracks = []) {
    return {
      playlistId: null,
      playlistName: "",
      totalTracks: Array.isArray(tracks) ? tracks.length : 0,
      tracks: Array.isArray(tracks) ? tracks : [],
      missingTrackIds: [],
    };
  },
};

