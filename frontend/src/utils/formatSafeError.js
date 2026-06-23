function redactSensitiveText(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  return value
    .replace(/Authorization\s*:\s*Bearer\s+[^\s",]+/gi, "Authorization: Bearer [REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]")
    .replace(/api_token=[^&\s"]+/gi, "api_token=[REDACTED]")
    .replace(/("api_token"\s*:\s*")[^"]+(")/gi, '$1[REDACTED]$2')
    .replace(/([A-Za-z]:[\\/][^\s"',)]+)+/g, "[REDACTED_PATH]")
    .replace(/\\\\[^\s"',)]+/g, "[REDACTED_PATH]")
    .replace(/\/(?:data|storage|sdcard)\/[^\s"',)]+/g, "[REDACTED_PATH]");
}

function toSafeString(value) {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}

function buildSafePreview(value, depth = 0, seen = new WeakSet()) {
  if (depth > 2) {
    return "[Truncated]";
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => buildSafePreview(entry, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const result = {};
    const blockedKeys = new Set([
      "authorization",
      "headers",
      "api_token",
      "token",
      "password",
    ]);

    for (const [key, entryValue] of Object.entries(value).slice(0, 10)) {
      if (blockedKeys.has(String(key).toLowerCase())) {
        result[key] = "[REDACTED]";
        continue;
      }

      result[key] = buildSafePreview(entryValue, depth + 1, seen);
    }

    return result;
  }

  return String(value);
}

function extractStackPreview(error) {
  const rawStack = toSafeString(error?.stack);

  if (!rawStack) {
    return [];
  }

  return rawStack
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function formatSafeError(error) {
  if (error instanceof Error) {
    return {
      name: toSafeString(error.name) || "Error",
      message: toSafeString(error.message) || "Unknown error.",
      code: toSafeString(error.code) || null,
      stackPreview: extractStackPreview(error),
      causeMessage: toSafeString(error.cause?.message ?? error.cause) || null,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: redactSensitiveText(error) || "Unknown error.",
      code: null,
      stackPreview: [],
      causeMessage: null,
    };
  }

  if (error === null || error === undefined) {
    return {
      name: "Error",
      message: "Unknown error.",
      code: null,
      stackPreview: [],
      causeMessage: null,
    };
  }

  const safeName = toSafeString(error?.name) || "Error";
  const safeMessage =
    toSafeString(error?.message) ||
    JSON.stringify(buildSafePreview(error)) ||
    "Unknown error.";

  return {
    name: safeName,
    message: safeMessage,
    code: toSafeString(error?.code) || null,
    stackPreview: extractStackPreview(error),
    causeMessage: toSafeString(error?.cause?.message ?? error?.cause) || null,
  };
}

export function getSafeErrorMessage(error, fallback = "Unknown error.") {
  const formatted = formatSafeError(error);
  return formatted.message || fallback;
}
