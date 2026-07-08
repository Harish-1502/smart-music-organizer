import { PLAYER_COMMANDS } from "./playerCommandNames";

export function parseMp3ControllerMessage(event) {
  const possibleValues = [event.key, event.code];

  console.log("MP3 controller event:", event);
  console.log("event.key:", event.key);
  console.log("event.code:", event.code);
  console.log("possibleValues:", possibleValues);

  if (possibleValues.includes("MediaPlayPause")) {
    return PLAYER_COMMANDS.PLAY_PAUSE;
  }

  if (possibleValues.includes("MediaTrackNext")) {
    return PLAYER_COMMANDS.NEXT_TRACK;
  }

  if (possibleValues.includes("MediaTrackPrevious")) {
    return PLAYER_COMMANDS.PREVIOUS_TRACK;
  }

  if (possibleValues.includes("AudioVolumeUp")) {
    return PLAYER_COMMANDS.VOLUME_UP;
  }

  if (possibleValues.includes("AudioVolumeDown")) {
    return PLAYER_COMMANDS.VOLUME_DOWN;
  }

  return null;
}

export function mp3CommandParser(event) {
  return parseMp3ControllerMessage(event);
}
