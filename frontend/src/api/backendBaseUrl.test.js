import { beforeEach, describe, expect, it, vi } from "vitest";

let isNativePlatform = false;
let currentPlatform = "web";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform,
    getPlatform: () => currentPlatform,
  },
}));

async function loadModule() {
  return import("./backendBaseUrl.js");
}

function createLocalStorageMock() {
  const store = new Map();

  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("backendBaseUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    isNativePlatform = false;
    currentPlatform = "web";

    global.window = {
      localStorage: createLocalStorageMock(),
    };
  });

  it("uses the saved backend URL before the build default", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://10.0.0.5:8000/");
    const {
      clearBackendBaseUrl,
      getBackendBaseUrl,
      setBackendBaseUrl,
    } = await loadModule();

    expect(getBackendBaseUrl()).toBe("http://10.0.0.5:8000");

    setBackendBaseUrl("http://192.168.68.112:8000/");
    expect(getBackendBaseUrl()).toBe("http://192.168.68.112:8000");

    clearBackendBaseUrl();
    expect(getBackendBaseUrl()).toBe("http://10.0.0.5:8000");
  });

  it("normalizes trailing slashes and preserves safe pathname prefixes", async () => {
    const { normalizeBackendBaseUrl } = await loadModule();

    expect(normalizeBackendBaseUrl("http://192.168.1.44:8000///")).toBe(
      "http://192.168.1.44:8000",
    );
    expect(normalizeBackendBaseUrl("https://example.com/music-api/")).toBe(
      "https://example.com/music-api",
    );
  });

  it("rejects invalid backend URLs", async () => {
    const { normalizeBackendBaseUrl } = await loadModule();

    expect(() => normalizeBackendBaseUrl("")).toThrow(
      "Enter a backend URL to continue.",
    );
    expect(() => normalizeBackendBaseUrl("192.168.1.55:8000")).toThrow(
      "valid http:// or https:// URL",
    );
    expect(() => normalizeBackendBaseUrl("ftp://192.168.1.55:8000")).toThrow(
      "must start with http:// or https://",
    );
    expect(() => normalizeBackendBaseUrl("http://example.com/?token=test")).toThrow(
      "must not include query strings or fragments",
    );
  });

  it("does not fall back to the browser localhost dev default on native Android", async () => {
    isNativePlatform = true;
    currentPlatform = "android";

    const { getBackendBaseUrl, getDefaultBackendBaseUrl } = await loadModule();

    expect(getDefaultBackendBaseUrl()).toBe("");
    expect(getBackendBaseUrl()).toBe("");
  });
});
