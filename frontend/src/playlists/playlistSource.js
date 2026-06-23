import { isOfflineMode } from "../appMode/appMode";
import { backendPlaylistSource } from "./backendPlaylistSource";
import { offlinePlaylistSource } from "./offlinePlaylistSource";

export function getPlaylistSourceForMode(mode) {
  return isOfflineMode(mode) ? offlinePlaylistSource : backendPlaylistSource;
}

