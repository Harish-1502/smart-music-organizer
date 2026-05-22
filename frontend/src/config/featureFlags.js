function readBooleanFlag(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

export const featureFlags = {
  enableAiPlaylists: readBooleanFlag(import.meta.env.VITE_ENABLE_AI_PLAYLISTS),
};
