import { useCallback } from "react";

import { PLAYER_COMMANDS } from "../controls/playerCommandNames";

export function usePlayerCommandDispatcher(actions) {
  // Centralizes external player commands so keyboard and MP3 controller inputs
  // both dispatch through the same action interface.
  return useCallback(
    (command) => {
      switch (command) {
        case PLAYER_COMMANDS.PLAY_PAUSE:
          actions.togglePlayPause();
          break;

        case PLAYER_COMMANDS.NEXT_TRACK:
          actions.nextTrack();
          break;

        case PLAYER_COMMANDS.PREVIOUS_TRACK:
          actions.previousTrack();
          break;

        case PLAYER_COMMANDS.VOLUME_UP:
          actions.adjustVolume(5);
          break;

        case PLAYER_COMMANDS.VOLUME_DOWN:
          actions.adjustVolume(-5);
          break;

        case PLAYER_COMMANDS.SEEK_FORWARD:
          actions.seekBy(10);
          break;

        case PLAYER_COMMANDS.SEEK_BACKWARD:
          actions.seekBy(-10);
          break;

        default:
          break;
      }
    },
    [actions],
  );
}
