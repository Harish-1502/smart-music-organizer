import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  vi.resetModules();
  vi.doMock("react", async () => {
    const actual = await vi.importActual("react");

    return {
      ...actual,
      useCallback: (callback) => callback,
    };
  });

  return import("./usePlayerCommandDispatcher.js");
}

describe("usePlayerCommandDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches supported player commands to the matching actions", async () => {
    const actions = {
      togglePlayPause: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      adjustVolume: vi.fn(),
      seekBy: vi.fn(),
    };

    const { usePlayerCommandDispatcher } = await loadModule();
    const dispatch = usePlayerCommandDispatcher(actions);

    dispatch("PLAY_PAUSE");
    dispatch("NEXT_TRACK");
    dispatch("PREVIOUS_TRACK");
    dispatch("VOLUME_UP");
    dispatch("VOLUME_DOWN");
    dispatch("SEEK_FORWARD");
    dispatch("SEEK_BACKWARD");

    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.nextTrack).toHaveBeenCalledTimes(1);
    expect(actions.previousTrack).toHaveBeenCalledTimes(1);
    expect(actions.adjustVolume).toHaveBeenNthCalledWith(1, 5);
    expect(actions.adjustVolume).toHaveBeenNthCalledWith(2, -5);
    expect(actions.seekBy).toHaveBeenNthCalledWith(1, 10);
    expect(actions.seekBy).toHaveBeenNthCalledWith(2, -10);
  });

  it("ignores unsupported commands", async () => {
    const actions = {
      togglePlayPause: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      adjustVolume: vi.fn(),
      seekBy: vi.fn(),
    };

    const { usePlayerCommandDispatcher } = await loadModule();
    const dispatch = usePlayerCommandDispatcher(actions);

    dispatch("UNKNOWN_COMMAND");

    expect(actions.togglePlayPause).not.toHaveBeenCalled();
    expect(actions.nextTrack).not.toHaveBeenCalled();
    expect(actions.previousTrack).not.toHaveBeenCalled();
    expect(actions.adjustVolume).not.toHaveBeenCalled();
    expect(actions.seekBy).not.toHaveBeenCalled();
  });
});
