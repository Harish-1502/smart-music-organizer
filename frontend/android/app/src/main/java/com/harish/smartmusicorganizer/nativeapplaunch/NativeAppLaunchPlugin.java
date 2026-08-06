package com.harish.smartmusicorganizer.nativeapplaunch;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAppLaunch")
public class NativeAppLaunchPlugin extends Plugin {
    @PluginMethod
    public void consumeLaunchRoute(PluginCall call) {
        Intent intent = getActivity() == null ? null : getActivity().getIntent();
        String route = extractLaunchRoute(intent);

        if (intent != null && !route.isEmpty()) {
            intent.setData(null);
            intent.setAction(Intent.ACTION_MAIN);
        }

        JSObject result = new JSObject();
        result.put("hasRoute", !route.isEmpty());
        result.put("route", route);
        call.resolve(result);
    }

    private String extractLaunchRoute(Intent intent) {
        if (intent == null) {
            return "";
        }

        Uri data = intent.getData();
        if (data == null) {
            return "";
        }

        String scheme = data.getScheme();
        if (scheme == null || !scheme.equalsIgnoreCase("smartmusicorganizer")) {
            return "";
        }

        String host = normalizeSegment(data.getHost());
        if (host.isEmpty()) {
            return "";
        }

        String path = normalizePath(data.getPath());
        return path.isEmpty() ? "/" + host : "/" + host + path;
    }

    private String normalizeSegment(String value) {
        if (value == null) {
            return "";
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private String normalizePath(String value) {
        if (value == null) {
            return "";
        }

        String trimmed = value.trim();
        if (trimmed.isEmpty() || "/".equals(trimmed)) {
            return "";
        }

        return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    }
}
