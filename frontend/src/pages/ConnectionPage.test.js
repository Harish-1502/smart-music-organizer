import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConnectionPage from "./ConnectionPage";

vi.mock("../api/apiBase", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("../api/backendBaseUrl", () => ({
  clearBackendBaseUrl: vi.fn(),
  getBackendBaseUrl: vi.fn(() => "http://192.168.68.112:8000"),
  getDefaultBackendBaseUrl: vi.fn(() => ""),
  hasSavedBackendBaseUrl: vi.fn(() => true),
  isNativeAndroidRuntime: vi.fn(() => true),
  normalizeBackendBaseUrl: vi.fn((value) => value),
  setBackendBaseUrl: vi.fn((value) => value),
}));

vi.mock("../api/apiErrors", () => ({
  getApiErrorMessage: vi.fn(() => "Unable to load connection details."),
}));

vi.mock("../appMode/appMode", () => ({
  getAppMode: vi.fn(() => "lan"),
  isOfflineMode: vi.fn((mode) => mode === "offline"),
  setAppMode: vi.fn((mode) => mode),
}));

describe("ConnectionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Android localhost warning in the connection settings UI", () => {
    const markup = renderToStaticMarkup(React.createElement(ConnectionPage));

    expect(markup).toContain(
      "Do not use localhost for your PC backend. Use your PC LAN IP.",
    );
    expect(markup).toContain("LAN Mode / Offline Mode");
    expect(markup).toContain("Backend URL");
    expect(markup).toContain("Test Connection");
  });
});
