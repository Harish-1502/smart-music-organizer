const API_BASE = "http://127.0.0.1:8000"

export async function scanLibrary(folderPath) {
  const res = await fetch(`${API_BASE}/library/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folder_path: folderPath }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Failed to scan library")
  }

  return res.json()
}

export async function getScanStatus() {
  const res = await fetch(`${API_BASE}/library/scan-status`)
  if (!res.ok) {
    throw new Error("Failed to fetch scan status")
  }
  return res.json()
}

export async function clearLibrary() {
  const res = await fetch("http://127.0.0.1:8000/library/clear", {
    method: "DELETE",
  })

  if (!res.ok) {
    throw new Error("Failed to clear library")
  }

  return res.json()
}