import { beforeEach, describe, expect, it, vi } from "vitest";

const useKeyboardPlayerControls = vi.fn();
const useMp3ControllerControls = vi.fn();
const usePlayerCommandDispatcher = vi.fn();

vi.mock("../../hooks/useKeyboardPlayerControls", () => ({
  useKeyboardPlayerControls,
}));

vi.mock("../../hooks/useMp3ControllerControls", () => ({
  useMp3ControllerControls,
}));

vi.mock("../../hooks/usePlayerCommandDispatcher", () => ({
  usePlayerCommandDispatcher,
}));

async function loadModule() {
  vi.resetModules();
  return import("../../hooks/usePlayerInputControls.js");
}

describe("usePlayerInputControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires keyboard and MP3 hooks to the shared command dispatcher", async () => {
    const actions = { nextTrack: vi.fn() };
    const handlePlayerCommand = vi.fn();
    usePlayerCommandDispatcher.mockReturnValue(handlePlayerCommand);

    const { usePlayerInputControls } = await loadModule();

    usePlayerInputControls({ actions, enabled: false });

    expect(usePlayerCommandDispatcher).toHaveBeenCalledWith(actions);
    expect(useKeyboardPlayerControls).toHaveBeenCalledWith({
      enabled: false,
      onCommand: handlePlayerCommand,
    });
    expect(useMp3ControllerControls).toHaveBeenCalledWith({
      enabled: false,
      onCommand: handlePlayerCommand,
    });
  });
});
