import { describe, expect, it } from "vitest";
import { formatSafeError, getSafeErrorMessage } from "./formatSafeError";

describe("formatSafeError", () => {
  it("formats Error instances with message, name, and stack preview", () => {
    const error = new Error("Socket timeout");
    error.name = "NetworkError";
    error.stack = [
      "NetworkError: Socket timeout",
      "at downloadLibrary (downloadLibrary.js:10:2)",
      "at persistTrack (mobileOfflineRepository.js:20:4)",
    ].join("\n");

    expect(formatSafeError(error)).toEqual({
      name: "NetworkError",
      message: "Socket timeout",
      code: null,
      stackPreview: [
        "NetworkError: Socket timeout",
        "at downloadLibrary (downloadLibrary.js:10:2)",
        "at persistTrack (mobileOfflineRepository.js:20:4)",
      ],
      causeMessage: null,
    });
  });

  it("formats plain objects without becoming [object Object]", () => {
    const formatted = formatSafeError({
      reason: "SQLite busy",
      retryable: true,
    });

    expect(formatted.name).toBe("Error");
    expect(formatted.message).toContain("SQLite busy");
    expect(formatted.message).not.toBe("[object Object]");
  });

  it("formats Capacitor-like error objects with code and message", () => {
    const formatted = formatSafeError({
      name: "CapacitorException",
      code: "SQLITE_ERROR",
      message: "SQLite constraint failed",
    });

    expect(formatted).toEqual({
      name: "CapacitorException",
      message: "SQLite constraint failed",
      code: "SQLITE_ERROR",
      stackPreview: [],
      causeMessage: null,
    });
  });

  it("redacts tokens and api_token query params", () => {
    const formatted = formatSafeError(
      new Error(
        'Authorization: Bearer abc123 api_token=secret-token https://example.test/tracks?api_token=secret-token',
      ),
    );

    expect(formatted.message).toContain("Authorization: Bearer [REDACTED]");
    expect(formatted.message).toContain("api_token=[REDACTED]");
    expect(formatted.message).not.toContain("abc123");
    expect(formatted.message).not.toContain("secret-token");
  });

  it("redacts Windows, UNC, and Android private paths", () => {
    const formatted = formatSafeError({
      message: "Failed at C:\\Music\\song.mp3 via \\\\DESKTOP\\Music\\song.mp3 and /data/user/0/app/files/song.mp3",
    });

    expect(formatted.message).toContain("[REDACTED_PATH]");
    expect(formatted.message).not.toContain("C:\\Music");
    expect(formatted.message).not.toContain("\\\\DESKTOP");
    expect(formatted.message).not.toContain("/data/user/0");
  });

  it("formats cause messages safely", () => {
    const error = new Error("Track save failed");
    error.cause = new Error("Duration was NaN");

    expect(formatSafeError(error)).toEqual(
      expect.objectContaining({
        message: "Track save failed",
        causeMessage: "Duration was NaN",
      }),
    );
  });

  it("returns a useful safe message helper", () => {
    expect(getSafeErrorMessage("plain string failure")).toBe("plain string failure");
    expect(getSafeErrorMessage(null, "Fallback")).toBe("Unknown error.");
  });
});
