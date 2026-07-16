package com.harish.smartmusicorganizer.nativeplayback;

import com.getcapacitor.JSObject;
import org.json.JSONException;

public final class NativeDownloadedPlaybackTrack {
    final String id;
    final String title;
    final String artist;
    final String album;
    final long durationMs;
    final String audioLocalUri;
    final String storageType;

    private NativeDownloadedPlaybackTrack(
            String id,
            String title,
            String artist,
            String album,
            long durationMs,
            String audioLocalUri,
            String storageType) {
        this.id = id;
        this.title = title;
        this.artist = artist;
        this.album = album;
        this.durationMs = durationMs;
        this.audioLocalUri = audioLocalUri;
        this.storageType = storageType;
    }

    static NativeDownloadedPlaybackTrack fromJsObject(JSObject value) {
        if (value == null) {
            return null;
        }

        String audioLocalUri = normalizeText(value.getString("audioLocalUri"), "");

        if (audioLocalUri.isEmpty()) {
            return null;
        }

        Double duration = null;
        try {
            duration = value.getDouble("duration");
        } catch (JSONException ignored) {
            // Leave duration unknown when the incoming payload omits it or sends a bad value.
        }

        return new NativeDownloadedPlaybackTrack(
                normalizeText(value.getString("id"), ""),
                normalizeText(value.getString("title"), "Unknown Title"),
                normalizeText(value.getString("artist"), ""),
                normalizeText(value.getString("album"), ""),
                normalizeDuration(duration),
                audioLocalUri,
                normalizeText(value.getString("storageType"), "native_file"));
    }

    JSObject toJsObject() {
        JSObject object = new JSObject();
        object.put("id", id);
        object.put("title", title);
        object.put("artist", artist);
        object.put("album", album);
        object.put("duration", durationMs >= 0 ? durationMs / 1000.0 : null);
        object.put("audioLocalUri", audioLocalUri);
        object.put("storageType", storageType);
        object.put("offline", true);
        return object;
    }

    private static String normalizeText(String value, String fallback) {
        if (value == null) {
            return fallback;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private static long normalizeDuration(Double value) {
        if (value == null || value.isNaN() || value.isInfinite() || value < 0) {
            return -1L;
        }

        return Math.round(value * 1000.0);
    }
}
