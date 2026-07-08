import { useEffect, useState } from "react";
import { createAuthenticatedBlobUrl } from "../../api/apiBase";

export default function useAuthenticatedBlobUrl(path, { enabled = true } = {}) {
  const [blobUrl, setBlobUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    setBlobUrl("");
    setError("");

    if (!enabled || !path) {
      return () => {};
    }

    async function loadBlobUrl() {
      try {
        objectUrl = await createAuthenticatedBlobUrl(path);

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setBlobUrl(objectUrl);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error && loadError.message.trim()
              ? loadError.message
              : "Unable to load protected media.",
          );
        }
      }
    }

    loadBlobUrl();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [enabled, path]);

  return { blobUrl, error };
}
