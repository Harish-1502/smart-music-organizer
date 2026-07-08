// features/player/controls/keyboardCommandMap.js

import { PLAYER_COMMANDS } from "./playerCommandNames";

export function getKeyboardPlayerCommand(event) {
  const tag = event.target?.tagName;

  const activeElement = document.activeElement;

  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    activeElement?.isContentEditable ||
    activeElement?.getAttribute("role") === "slider"
  ) {
    return null;
  }

  switch (event.code) {
    case "Space":
      return PLAYER_COMMANDS.PLAY_PAUSE;

    case "ArrowUp":
      return PLAYER_COMMANDS.VOLUME_UP;

    case "ArrowDown":
      return PLAYER_COMMANDS.VOLUME_DOWN;

    case "ArrowRight":
      return PLAYER_COMMANDS.SEEK_FORWARD;

    case "ArrowLeft":
      return PLAYER_COMMANDS.SEEK_BACKWARD;

    case "KeyN":
      return PLAYER_COMMANDS.NEXT_TRACK;

    case "KeyP":
      return PLAYER_COMMANDS.PREVIOUS_TRACK;

    default:
      return null;
  }
}
