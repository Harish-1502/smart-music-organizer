export function getApiErrorMessage(
  error,
  fallback = "Something went wrong."
) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          const itemMessage = item.msg || item.message;
          return typeof itemMessage === "string" ? itemMessage.trim() : "";
        }

        return "";
      })
      .find(Boolean);

    if (message) {
      return message;
    }
  }

  if (detail && typeof detail === "object") {
    const message = detail.msg || detail.message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
