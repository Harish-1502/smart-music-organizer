import { isOfflineMode } from "../appMode/appMode";
import { backendLibrarySource } from "./backendLibrarySource";
import { offlineLibrarySource } from "./offlineLibrarySource";

export function getLibrarySourceForMode(mode) {
  return isOfflineMode(mode) ? offlineLibrarySource : backendLibrarySource;
}

