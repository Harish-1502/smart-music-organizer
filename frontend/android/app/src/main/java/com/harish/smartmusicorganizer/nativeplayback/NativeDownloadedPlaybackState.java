package com.harish.smartmusicorganizer.nativeplayback;

import com.getcapacitor.JSObject;

import androidx.media3.common.Player;

public final class NativeDownloadedPlaybackState {
    final boolean available;
    final boolean active;
    final boolean isPlaying;
    final boolean isLoading;
    final boolean isBuffering;
    final boolean isReady;
    final int queueSize;
    final int currentIndex;
    final String currentTrackId;
    final long positionMs;
    final long durationMs;
    final boolean shuffleEnabled;
    final String repeatMode;
    final float volume;
    final boolean muted;
    final String errorMessage;
    final long updatedAtMs;

    private NativeDownloadedPlaybackState(
            boolean available,
            boolean active,
            boolean isPlaying,
            boolean isLoading,
            boolean isBuffering,
            boolean isReady,
            int queueSize,
            int currentIndex,
            String currentTrackId,
            long positionMs,
            long durationMs,
            boolean shuffleEnabled,
            String repeatMode,
            float volume,
            boolean muted,
            String errorMessage,
            long updatedAtMs) {
        this.available = available;
        this.active = active;
        this.isPlaying = isPlaying;
        this.isLoading = isLoading;
        this.isBuffering = isBuffering;
        this.isReady = isReady;
        this.queueSize = queueSize;
        this.currentIndex = currentIndex;
        this.currentTrackId = currentTrackId;
        this.positionMs = positionMs;
        this.durationMs = durationMs;
        this.shuffleEnabled = shuffleEnabled;
        this.repeatMode = repeatMode;
        this.volume = volume;
        this.muted = muted;
        this.errorMessage = errorMessage;
        this.updatedAtMs = updatedAtMs;
    }

    static NativeDownloadedPlaybackState unavailable() {
        return new NativeDownloadedPlaybackState(
                false,
                false,
                false,
                false,
                false,
                false,
                0,
                -1,
                "",
                0L,
                0L,
                false,
                "off",
                1.0f,
                false,
                "",
                System.currentTimeMillis());
    }

    static NativeDownloadedPlaybackState fromPlayer(
            Player player,
            int queueSize,
            String currentTrackId,
            float requestedVolume,
            boolean muted,
            String repeatMode,
            String errorMessage) {
        if (player == null) {
            return unavailable();
        }

        long durationMs = player.getDuration();
        if (durationMs < 0) {
            durationMs = 0L;
        }

        return new NativeDownloadedPlaybackState(
                true,
                queueSize > 0,
                player.isPlaying(),
                player.getPlaybackState() == Player.STATE_BUFFERING
                        || player.getPlaybackState() == Player.STATE_IDLE,
                player.getPlaybackState() == Player.STATE_BUFFERING,
                player.getPlaybackState() == Player.STATE_READY,
                queueSize,
                player.getCurrentMediaItemIndex(),
                currentTrackId == null ? "" : currentTrackId,
                Math.max(0L, player.getCurrentPosition()),
                durationMs,
                player.getShuffleModeEnabled(),
                repeatMode,
                requestedVolume,
                muted,
                errorMessage == null ? "" : errorMessage,
                System.currentTimeMillis());
    }

    JSObject toJsObject() {
        JSObject object = new JSObject();
        object.put("available", available);
        object.put("active", active);
        object.put("isPlaying", isPlaying);
        object.put("isLoading", isLoading);
        object.put("isBuffering", isBuffering);
        object.put("isReady", isReady);
        object.put("queueSize", queueSize);
        object.put("currentIndex", currentIndex);
        object.put("currentTrackId", currentTrackId);
        object.put("positionMs", positionMs);
        object.put("durationMs", durationMs);
        object.put("shuffleEnabled", shuffleEnabled);
        object.put("repeatMode", repeatMode);
        object.put("volume", volume);
        object.put("muted", muted);
        object.put("errorMessage", errorMessage);
        object.put("updatedAtMs", updatedAtMs);
        return object;
    }
}
