const HIDDEN_PATH_VALUE = "Hidden in demo mode";
const DEMO_MODE_STORAGE_KEY = "demoMode";
export const DEMO_MODE_UPDATED_EVENT =
  "smart-music-organizer:demo-mode-updated";

function canUseLocalStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readStoredDemoModeValue() {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);

    if (storedValue === "true") {
      return true;
    }

    if (storedValue === "false") {
      return false;
    }
  } catch {}

  return null;
}

function getDemoIndex(value, fallbackIndex = 0) {
  const numericValue = Number(value);

  if (Number.isInteger(numericValue) && numericValue > 0) {
    return numericValue;
  }

  return fallbackIndex + 1;
}

function padTrackNumber(value) {
  return String(value).padStart(3, "0");
}

export function isDemoMode() {
  const storedValue = readStoredDemoModeValue();

  if (storedValue !== null) {
    return storedValue;
  }

  const envEnabled = import.meta.env.VITE_DEMO_MODE === "true";

  if (envEnabled) {
    return true;
  }

  return false;
}

export function setDemoMode(value) {
  const normalizedValue = Boolean(value);

  if (typeof window !== "undefined") {
    if (canUseLocalStorage()) {
      try {
        if (normalizedValue) {
          window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "true");
        } else {
          window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
        }
      } catch {}
    }

    window.dispatchEvent(
      new CustomEvent(DEMO_MODE_UPDATED_EVENT, {
        detail: { enabled: normalizedValue },
      }),
    );
  }

  return normalizedValue;
}

export function hasDemoModePreference() {
  return readStoredDemoModeValue() !== null;
}

export function hiddenPathValue() {
  return HIDDEN_PATH_VALUE;
}

export function maskTrack(track, index = 0) {
  if (!isDemoMode() || !track || typeof track !== "object") {
    return track;
  }

  const demoIndex = getDemoIndex(track.track_id ?? track.id, index);
  const artistIndex = ((demoIndex - 1) % 12) + 1;
  const albumIndex = ((demoIndex - 1) % 8) + 1;
  const demoTitle = `Demo Track ${padTrackNumber(demoIndex)}`;
  const demoArtist = `Demo Artist ${artistIndex}`;
  const demoAlbum = `Demo Album ${albumIndex}`;
  const demoFileName = `demo_track_${padTrackNumber(demoIndex)}.mp3`;

  return {
    ...track,
    title: demoTitle,
    display_title: demoTitle,
    scanned_title: demoTitle,
    artist: demoArtist,
    display_artist: demoArtist,
    scanned_artist: demoArtist,
    album: demoAlbum,
    display_album: demoAlbum,
    scanned_album: demoAlbum,
    file_name: demoFileName,
    filename: demoFileName,
    file_path: HIDDEN_PATH_VALUE,
    folder_path: HIDDEN_PATH_VALUE,
    art_path: null,
  };
}

export function maskPlaylist(playlist, index = 0) {
  if (!isDemoMode() || !playlist || typeof playlist !== "object") {
    return playlist;
  }

  const demoIndex = getDemoIndex(playlist.playlist_id ?? playlist.id, index);

  return {
    ...playlist,
    name: `Demo Playlist ${padTrackNumber(demoIndex)}`,
  };
}

export function maskOfflineTrack(track, index = 0) {
  return maskTrack(track, index);
}

export function maskTracks(tracks) {
  if (!Array.isArray(tracks) || !isDemoMode()) {
    return tracks;
  }

  return tracks.map((track, index) => maskTrack(track, index));
}

export function maskArtistItem(item, index = 0) {
  if (!isDemoMode() || !item || typeof item !== "object") {
    return item;
  }

  return {
    ...item,
    artist: `Demo Artist ${index + 1}`,
  };
}

export function maskAlbumItem(item, index = 0) {
  if (!isDemoMode() || !item || typeof item !== "object") {
    return item;
  }

  return {
    ...item,
    album: `Demo Album ${index + 1}`,
    artist: `Demo Artist ${((index % 12) + 1)}`,
  };
}

export function shouldHideDemoArtwork() {
  return isDemoMode();
}
