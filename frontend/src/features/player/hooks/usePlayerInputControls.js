import { useMp3ControllerControls } from "./useMp3ControllerControls";
import { useKeyboardPlayerControls } from "./useKeyboardPlayerControls";
import { usePlayerCommandDispatcher } from "./usePlayerCommandDispatcher";

export function usePlayerInputControls({ actions, enabled = true }) {
  // Creates one shared command dispatcher so all non-UI inputs trigger the
  // same player actions.
  const handlePlayerCommand = usePlayerCommandDispatcher(actions);

  useKeyboardPlayerControls({
    enabled,
    onCommand: handlePlayerCommand,
  });

  useMp3ControllerControls({
    enabled,
    onCommand: handlePlayerCommand,
  });
}
