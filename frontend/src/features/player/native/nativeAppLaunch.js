import { Capacitor, registerPlugin } from "@capacitor/core";

const NativeAppLaunchPlugin = registerPlugin("NativeAppLaunch");
const DEBUG_TAG = "native-app-launch";

function logDebug(phase, details = {}) {
  console.info(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

function logWarn(phase, details = {}) {
  console.warn(`[${DEBUG_TAG}:${phase}] ${JSON.stringify(details)}`);
}

export function isAndroidNativeRuntime() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function consumeNativeAppLaunchRoute() {
  if (!isAndroidNativeRuntime()) {
    logDebug("consume-skipped", { reason: "not-android" });
    return "";
  }

  try {
    const result = await NativeAppLaunchPlugin.consumeLaunchRoute();
    const route = typeof result?.route === "string" ? result.route : "";
    logDebug("consume-ok", { hasRoute: Boolean(result?.hasRoute), route });
    return route;
  } catch (error) {
    logWarn("consume-failed", {
      message: error instanceof Error ? error.message : "",
    });
    return "";
  }
}
