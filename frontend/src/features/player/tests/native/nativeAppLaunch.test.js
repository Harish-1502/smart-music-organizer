import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = {
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => "android"),
};

const pluginMocks = {
  consumeLaunchRoute: vi.fn(),
};

vi.mock("@capacitor/core", () => ({
  Capacitor: capacitorMocks,
  registerPlugin: vi.fn(() => pluginMocks),
}));

async function loadModule() {
  vi.resetModules();
  return import("../../native/nativeAppLaunch.js");
}

describe("nativeAppLaunch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("android");
  });

  it("consumes the pending launch route", async () => {
    const { consumeNativeAppLaunchRoute } = await loadModule();

    pluginMocks.consumeLaunchRoute.mockResolvedValue({
      hasRoute: true,
      route: "/player",
    });

    await expect(consumeNativeAppLaunchRoute()).resolves.toBe("/player");
    expect(pluginMocks.consumeLaunchRoute).toHaveBeenCalledTimes(1);
  });

  it("skips when not running on android", async () => {
    const { consumeNativeAppLaunchRoute } = await loadModule();
    capacitorMocks.isNativePlatform.mockReturnValue(false);

    await expect(consumeNativeAppLaunchRoute()).resolves.toBe("");
    expect(pluginMocks.consumeLaunchRoute).not.toHaveBeenCalled();
  });
});
