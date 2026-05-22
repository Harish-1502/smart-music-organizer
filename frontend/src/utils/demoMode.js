const HIDDEN_PATH_VALUE = "Hidden in demo mode";

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
  const envEnabled = import.meta.env.VITE_DEMO_MODE === "true";

  if (envEnabled) {
    return true;
  }

  if (!canUseLocalStorage()) {
    return false;
  }

  try {
    return window.localStorage.getItem("demoMode") === "true";
  } catch {
    return false;
  }
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
