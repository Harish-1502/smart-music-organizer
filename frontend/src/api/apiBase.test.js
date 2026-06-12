import { beforeEach, describe, expect, it, vi } from "vitest";

const authTokenMocks = {
  getAuthHeaders: vi.fn(),
};

const backendBaseUrlMocks = {
  getBackendBaseUrl: vi.fn(),
  normalizeBackendBaseUrl: vi.fn(),
};

vi.mock("./authToken", () => authTokenMocks);
vi.mock("./backendBaseUrl", () => backendBaseUrlMocks);

async function loadModule() {
  return import("./apiBase.js");
}

describe("apiBase", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    authTokenMocks.getAuthHeaders.mockReturnValue({
      Authorization: "Bearer lan-token",
    });
    backendBaseUrlMocks.getBackendBaseUrl.mockReturnValue(
      "http://192.168.68.112:8000",
    );
    backendBaseUrlMocks.normalizeBackendBaseUrl.mockImplementation((value) =>
      typeof value === "string" ? value.replace(/\/+$/, "") : value,
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" })),
    });
  });

  it("uses the runtime backend URL for API path helpers and media fetches", async () => {
    const {
      apiUrl,
      fetchAuthenticatedBlob,
      getTrackArtPath,
      getTrackStreamPath,
    } = await loadModule();

    expect(apiUrl("/system/network-info")).toBe(
      "http://192.168.68.112:8000/system/network-info",
    );
    expect(getTrackStreamPath("55")).toBe(
      "http://192.168.68.112:8000/tracks/55/stream",
    );
    expect(getTrackArtPath("55")).toBe(
      "http://192.168.68.112:8000/tracks/55/art",
    );

    await fetchAuthenticatedBlob("/tracks/55/stream");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://192.168.68.112:8000/tracks/55/stream",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer lan-token",
        },
      }),
    );
    const [requestUrl] = global.fetch.mock.calls[0];
    expect(requestUrl).not.toContain("api_token=");
  });

  it("lets Axios JSON requests inherit the runtime backend URL", async () => {
    const { api } = await loadModule();
    const interceptor = api.interceptors.request.handlers[0].fulfilled;

    const config = await interceptor({
      url: "/tracks",
      headers: {},
    });

    expect(config.baseURL).toBe("http://192.168.68.112:8000");
    expect(config.headers.Authorization).toBe("Bearer lan-token");
  });
});
