import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = {
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("./apiBase", () => ({
  api: apiMocks,
}));

async function loadLibraryApi() {
  return import("./libraryApi.js");
}

describe("libraryApi", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sends the requested PC scan root to the backend scan endpoint", async () => {
    apiMocks.post.mockResolvedValue({
      data: { message: "Scan started" },
    });

    const { scanLibrary } = await loadLibraryApi();
    const result = await scanLibrary("S:\\Music");

    expect(apiMocks.post).toHaveBeenCalledWith("/library/scan", {
      folder_path: "S:\\Music",
    });
    expect(result).toEqual({ message: "Scan started" });
  });
});
