package com.harish.smartmusicorganizer.nativeplayback;

import android.os.Build;
import android.util.Log;

import androidx.annotation.Nullable;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;

@CapacitorPlugin(
        name = "NativeDownloadedPlayback",
        permissions = {
                @Permission(
                        alias = "postNotifications",
                        strings = {android.Manifest.permission.POST_NOTIFICATIONS})
        })
public class NativeDownloadedPlaybackPlugin extends Plugin {
    private static final String TAG = "NativeDownloadedPlayback";

    private void log(String message) {
        Log.d(TAG, message);
    }

    private void warn(String message) {
        Log.w(TAG, message);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        log("isAvailable");
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    @PluginMethod
    public void loadQueue(PluginCall call) {
        log("loadQueue requested");
        List<NativeDownloadedPlaybackTrack> tracks = readTracks(call.getArray("tracks"));
        int startIndex = safeInt(call.getInt("startIndex"), 0);
        boolean autoplay = call.getBoolean("autoplay", true);
        boolean shuffleEnabled = call.getBoolean("shuffleEnabled", false);
        String repeatMode = safeText(call.getString("repeatMode"), "off");
        float volume = safeFloat(call.getFloat("volume"), 1.0f);

        log(
                "loadQueue tracks="
                        + tracks.size()
                        + " startIndex="
                        + startIndex
                        + " autoplay="
                        + autoplay
                        + " shuffleEnabled="
                        + shuffleEnabled
                        + " repeatMode="
                        + repeatMode
                        + " volume="
                        + volume);

        if (tracks.isEmpty()) {
            warn("loadQueue received no valid tracks");
        }

        if (!tracks.isEmpty()) {
            log("loadQueue firstTrackId=" + tracks.get(0).id);
        }

        NativeDownloadedPlaybackService.enqueueLoadQueue(
                getContext(),
                tracks,
                startIndex,
                autoplay,
                shuffleEnabled,
                repeatMode,
                volume);

        call.resolve(buildSyntheticState(
                tracks.size(),
                startIndex,
                autoplay,
                shuffleEnabled,
                repeatMode,
                volume,
                tracks));
    }

    @PluginMethod
    public void play(PluginCall call) {
        log("play");
        dispatchCommand(call, NativeDownloadedPlaybackService.ACTION_PLAY, null, null, null, null, null);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        log("pause");
        dispatchCommand(call, NativeDownloadedPlaybackService.ACTION_PAUSE, null, null, null, null, null);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        log("stop");
        dispatchCommand(call, NativeDownloadedPlaybackService.ACTION_STOP, null, null, null, null, null);
    }

    @PluginMethod
    public void next(PluginCall call) {
        log("next");
        dispatchCommand(call, NativeDownloadedPlaybackService.ACTION_NEXT, null, null, null, null, null);
    }

    @PluginMethod
    public void previous(PluginCall call) {
        log("previous");
        dispatchCommand(call, NativeDownloadedPlaybackService.ACTION_PREVIOUS, null, null, null, null, null);
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = safeLong(call.getDouble("positionMs"), 0L);
        log("seekTo positionMs=" + positionMs);
        dispatchCommand(
                call,
                NativeDownloadedPlaybackService.ACTION_SEEK_TO,
                positionMs,
                null,
                null,
                null,
                null);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        log("setVolume volume=" + safeFloat(call.getFloat("volume"), 1.0f));
        dispatchCommand(
                call,
                NativeDownloadedPlaybackService.ACTION_SET_VOLUME,
                null,
                null,
                null,
                null,
                safeFloat(call.getFloat("volume"), 1.0f));
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        log("setMuted muted=" + call.getBoolean("muted", false));
        dispatchCommand(
                call,
                NativeDownloadedPlaybackService.ACTION_SET_MUTED,
                null,
                call.getBoolean("muted", false),
                null,
                null,
                null);
    }

    @PluginMethod
    public void setShuffleEnabled(PluginCall call) {
        log("setShuffleEnabled enabled=" + call.getBoolean("enabled", false));
        dispatchCommand(
                call,
                NativeDownloadedPlaybackService.ACTION_SET_SHUFFLE,
                null,
                null,
                call.getBoolean("enabled", false),
                null,
                null);
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        log("setRepeatMode repeatMode=" + safeText(call.getString("repeatMode"), "off"));
        dispatchCommand(
                call,
                NativeDownloadedPlaybackService.ACTION_SET_REPEAT_MODE,
                null,
                null,
                null,
                safeText(call.getString("repeatMode"), "off"),
                null);
    }

    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        log("ensureNotificationPermission");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (getPermissionState("postNotifications") == PermissionState.GRANTED) {
            log("ensureNotificationPermission already granted");
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        log("ensureNotificationPermission requesting permission");
        requestPermissionForAlias("postNotifications", call, "ensureNotificationPermissionCallback");
    }

    @PluginMethod
    public void getState(PluginCall call) {
        log("getState");
        call.resolve(NativeDownloadedPlaybackService.getSnapshot().toJsObject());
    }

    @PermissionCallback
    private void ensureNotificationPermissionCallback(PluginCall call) {
        log("ensureNotificationPermissionCallback");
        JSObject result = new JSObject();
        result.put("available", true);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        result.put(
                "granted",
                getPermissionState("postNotifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    private void dispatchCommand(
            PluginCall call,
            String action,
            @Nullable Long positionMs,
            @Nullable Boolean muted,
            @Nullable Boolean shuffleEnabled,
            @Nullable String repeatMode,
            @Nullable Float volume) {
        log("dispatchCommand action=" + action);
        NativeDownloadedPlaybackService.enqueueCommand(
                getContext(),
                action,
                positionMs,
                muted,
                shuffleEnabled,
                repeatMode,
                volume);

        call.resolve(NativeDownloadedPlaybackService.getSnapshot().toJsObject());
    }

    private JSObject buildSyntheticState(
            int queueSize,
            int startIndex,
            boolean autoplay,
            boolean shuffleEnabled,
            String repeatMode,
            float volume,
            List<NativeDownloadedPlaybackTrack> tracks) {
        JSObject object = NativeDownloadedPlaybackService.getSnapshot().toJsObject();
        int clampedIndex = clampIndex(startIndex, queueSize);
        object.put("available", true);
        object.put("active", queueSize > 0);
        object.put("isPlaying", autoplay);
        object.put("isLoading", false);
        object.put("isBuffering", false);
        object.put("isReady", queueSize > 0);
        object.put("queueSize", queueSize);
        object.put("currentIndex", clampedIndex);
        object.put(
                "currentTrackId",
                queueSize > 0 && !tracks.isEmpty()
                        ? tracks.get(clampIndex(startIndex, tracks.size())).id
                        : "");
        object.put("shuffleEnabled", shuffleEnabled);
        object.put("repeatMode", repeatMode);
        object.put("volume", volume);
        object.put("muted", false);
        object.put("errorMessage", "");
        return object;
    }

    private List<NativeDownloadedPlaybackTrack> readTracks(@Nullable JSArray array) {
        List<NativeDownloadedPlaybackTrack> tracks = new ArrayList<>();

        if (array == null) {
            return tracks;
        }

        for (int index = 0; index < array.length(); index++) {
            try {
                JSObject entry = JSObject.fromJSONObject(array.getJSONObject(index));
                NativeDownloadedPlaybackTrack track = NativeDownloadedPlaybackTrack.fromJsObject(entry);
                if (track != null) {
                    tracks.add(track);
                } else {
                    warn("readTracks skipped null track at index=" + index);
                }
            } catch (JSONException ignored) {
                warn("readTracks skipped malformed track at index=" + index);
                // Skip malformed entries so one bad track payload does not fail queue loading.
            }
        }

        return tracks;
    }

    private int safeInt(@Nullable Integer value, int fallback) {
        return value == null ? fallback : value;
    }

    private long safeLong(@Nullable Long value, long fallback) {
        return value == null ? fallback : value;
    }

    private float safeFloat(@Nullable Float value, float fallback) {
        return value == null || value.isNaN() || value.isInfinite() ? fallback : value;
    }

    private String safeText(@Nullable String value, String fallback) {
        if (value == null) {
            return fallback;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private int clampIndex(int value, int size) {
        if (size <= 0) {
            return -1;
        }

        return Math.min(Math.max(value, 0), size - 1);
    }

    private long safeLong(@Nullable Double value, long fallback) {
        if (value == null || value.isNaN() || value.isInfinite()) {
            return fallback;
        }

        return Math.max(0L, Math.round(value));
    }
}
