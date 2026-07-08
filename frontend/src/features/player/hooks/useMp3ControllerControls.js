// features/player/hooks/useMp3ControllerControls.js

import { useEffect } from "react";
import { parseMp3ControllerMessage } from "../controls/mp3CommandParser";

export function useMp3ControllerControls({ enabled = true, onCommand }) {
  useEffect(() => {
    if (!enabled) return;

    function handleMp3KeyDown(event) {
      const possibleValues = [event.key, event.code];

      console.log("MP3 keydown detected");
      console.log("event.key:", event.key);
      console.log("event.code:", event.code);
      console.log("possibleValues:", possibleValues);

      const command = parseMp3ControllerMessage(event);

      console.log("parsed MP3 command:", command);

      if (!command) return;

      event.preventDefault();
      onCommand(command);
    }

    window.addEventListener("keydown", handleMp3KeyDown);

    return () => {
      window.removeEventListener("keydown", handleMp3KeyDown);
    };
  }, [enabled, onCommand]);
}