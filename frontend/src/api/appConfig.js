import { api } from "./apiBase";
import { hasDemoModePreference, setDemoMode } from "../utils/demoMode";

export function applyNetworkInfoConfig(networkInfo) {
  if (!networkInfo || typeof networkInfo !== "object") {
    return;
  }

  if (typeof networkInfo.demo_mode === "boolean" && !hasDemoModePreference()) {
    setDemoMode(networkInfo.demo_mode);
  }
}

export async function syncAppConfig(baseURL) {
  const response = await api.get(
    "/system/network-info",
    baseURL ? { baseURL } : undefined,
  );

  applyNetworkInfoConfig(response.data);
  return response.data;
}
