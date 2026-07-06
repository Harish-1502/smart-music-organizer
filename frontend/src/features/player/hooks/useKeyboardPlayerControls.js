import { useEffect } from "react";
import { getKeyboardPlayerCommand } from "../controls/keyboardCommandMap";

export function useKeyboardPlayerControls({ enabled = true, onCommand }) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event) {
      const command = getKeyboardPlayerCommand(event);

      if (!command) return;

      event.preventDefault();
      onCommand(command);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onCommand]);
}