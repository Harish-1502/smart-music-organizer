import { useMp3ControllerControls } from "./useMp3ControllerControls";
import { useKeyboardPlayerControls } from "./useKeyboardPlayerControls";
import { usePlayerCommandDispatcher } from "./usePlayerCommandDispatcher";

export function usePlayerInputControls({ actions, enabled = true }) {
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
