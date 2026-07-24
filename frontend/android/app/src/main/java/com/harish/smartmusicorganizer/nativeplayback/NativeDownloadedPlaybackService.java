package com.harish.smartmusicorganizer.nativeplayback;

import android.content.Context;
import android.content.Intent;
import android.app.PendingIntent;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.common.util.UnstableApi;

import com.harish.smartmusicorganizer.MainActivity;
import com.harish.smartmusicorganizer.R;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@UnstableApi
public class NativeDownloadedPlaybackService extends MediaSessionService {
    private static final String TAG = "NativePlaybackService";
    private static final String NOTIFICATION_CHANNEL_ID =
            "smart_music_organizer_playback";
    private static final int NOTIFICATION_ID = 1001;
    private static final int REQUEST_CODE_CONTENT = 100;
    private static final int REQUEST_CODE_PREVIOUS = 101;
    private static final int REQUEST_CODE_PLAY_PAUSE = 102;
    private static final int REQUEST_CODE_NEXT = 103;
    public static final String ACTION_LOAD_QUEUE = "com.harish.smartmusicorganizer.nativeplayback.LOAD_QUEUE";
    public static final String ACTION_PLAY = "com.harish.smartmusicorganizer.nativeplayback.PLAY";
    public static final String ACTION_PAUSE = "com.harish.smartmusicorganizer.nativeplayback.PAUSE";
    public static final String ACTION_STOP = "com.harish.smartmusicorganizer.nativeplayback.STOP";
    public static final String ACTION_NEXT = "com.harish.smartmusicorganizer.nativeplayback.NEXT";
    public static final String ACTION_PREVIOUS = "com.harish.smartmusicorganizer.nativeplayback.PREVIOUS";
    public static final String ACTION_SEEK_TO = "com.harish.smartmusicorganizer.nativeplayback.SEEK_TO";
    public static final String ACTION_SET_VOLUME = "com.harish.smartmusicorganizer.nativeplayback.SET_VOLUME";
    public static final String ACTION_SET_MUTED = "com.harish.smartmusicorganizer.nativeplayback.SET_MUTED";
    public static final String ACTION_SET_SHUFFLE = "com.harish.smartmusicorganizer.nativeplayback.SET_SHUFFLE";
    public static final String ACTION_SET_REPEAT_MODE = "com.harish.smartmusicorganizer.nativeplayback.SET_REPEAT_MODE";

    public static final String EXTRA_START_INDEX = "startIndex";
    public static final String EXTRA_AUTOPLAY = "autoplay";
    public static final String EXTRA_SHUFFLE_ENABLED = "shuffleEnabled";
    public static final String EXTRA_REPEAT_MODE = "repeatMode";
    public static final String EXTRA_VOLUME = "volume";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_MUTED = "muted";

    private static final Object PENDING_LOCK = new Object();
    private static List<NativeDownloadedPlaybackTrack> pendingQueueTracks = new ArrayList<>();
    private static volatile NativeDownloadedPlaybackState currentState =
            NativeDownloadedPlaybackState.unavailable();

    private ExoPlayer player;
    private MediaSession mediaSession;
    private final Handler snapshotHandler = new Handler(Looper.getMainLooper());
    private final Runnable snapshotTicker =
            new Runnable() {
                @Override
                public void run() {
                    if (player == null) {
                        return;
                    }

                    updateSnapshot();

                    if (player.isPlaying()) {
                        snapshotHandler.postDelayed(this, 250L);
                    }
                }
            };
    private List<NativeDownloadedPlaybackTrack> queueTracks = new ArrayList<>();
    private float requestedVolume = 1.0f;
    private boolean muted = false;
    private String repeatMode = "off";
    private String lastErrorMessage = "";
    private String lastForegroundNotificationKey = "";

    private void log(String message) {
        Log.d(TAG, message);
    }

    private void warn(String message) {
        Log.w(TAG, message);
    }

    private void error(Throwable throwable) {
        Log.e(TAG, "onPlayerError", throwable);
    }

    public static void enqueueLoadQueue(
            Context context,
            List<NativeDownloadedPlaybackTrack> tracks,
            int startIndex,
            boolean autoplay,
            boolean shuffleEnabled,
            String repeatMode,
            float volume) {
        synchronized (PENDING_LOCK) {
            pendingQueueTracks = tracks == null ? new ArrayList<>() : new ArrayList<>(tracks);
        }

        Intent intent = new Intent(context, NativeDownloadedPlaybackService.class);
        intent.setAction(ACTION_LOAD_QUEUE);
        intent.putExtra(EXTRA_START_INDEX, startIndex);
        intent.putExtra(EXTRA_AUTOPLAY, autoplay);
        intent.putExtra(EXTRA_SHUFFLE_ENABLED, shuffleEnabled);
        intent.putExtra(EXTRA_REPEAT_MODE, repeatMode);
        intent.putExtra(EXTRA_VOLUME, volume);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void enqueueCommand(
            Context context,
            String action,
            @Nullable Long positionMs,
            @Nullable Boolean muted,
            @Nullable Boolean shuffleEnabled,
            @Nullable String repeatMode,
            @Nullable Float volume) {
        Intent intent = new Intent(context, NativeDownloadedPlaybackService.class);
        intent.setAction(action);

        if (positionMs != null) {
            intent.putExtra(EXTRA_POSITION_MS, positionMs.longValue());
        }
        if (muted != null) {
            intent.putExtra(EXTRA_MUTED, muted);
        }
        if (shuffleEnabled != null) {
            intent.putExtra(EXTRA_SHUFFLE_ENABLED, shuffleEnabled);
        }
        if (repeatMode != null) {
            intent.putExtra(EXTRA_REPEAT_MODE, repeatMode);
        }
        if (volume != null) {
            intent.putExtra(EXTRA_VOLUME, volume);
        }

        ContextCompat.startForegroundService(context, intent);
    }

    public static NativeDownloadedPlaybackState getSnapshot() {
        return currentState;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        log("onCreate");
        createPlayer();
        ensureForegroundNotification();
        updateSnapshot();
    }

    @Override
    public void onDestroy() {
        log("onDestroy");
        snapshotHandler.removeCallbacksAndMessages(null);
        releasePlayer();
        queueTracks = new ArrayList<>();
        synchronized (PENDING_LOCK) {
            pendingQueueTracks.clear();
        }
        requestedVolume = 1.0f;
        muted = false;
        repeatMode = "off";
        lastErrorMessage = "";
        currentState = NativeDownloadedPlaybackState.unavailable();
        super.onDestroy();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        log("onGetSession controller=" + controllerInfo);
        return mediaSession;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        log(
                "onStartCommand action="
                        + (intent == null ? "null" : intent.getAction())
                        + " flags="
                        + flags
                        + " startId="
                        + startId);
        if (intent != null) {
            handleIntent(intent);
        } else {
            warn("onStartCommand received null intent");
        }

        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(@NonNull Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        log("onTaskRemoved isPlaying=" + (player != null && player.isPlaying()));

        if (player != null && player.isPlaying()) {
            return;
        }

        stopForegroundPlaybackAndSelf();
    }

    private void createPlayer() {
        if (player != null) {
            return;
        }

        log("createPlayer");

        AudioAttributes audioAttributes =
                new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .build();

        player =
                new ExoPlayer.Builder(this)
                        .setHandleAudioBecomingNoisy(true)
                        .build();
        player.setAudioAttributes(audioAttributes, true);
        player.addListener(
                new Player.Listener() {
                    @Override
                    public void onEvents(@NonNull Player player, @NonNull Player.Events events) {
                        log("player onEvents playbackState=" + player.getPlaybackState() + " isPlaying=" + player.isPlaying());
                        updateSnapshot();
                    }

                    @Override
                    public void onMediaItemTransition(
                            @Nullable MediaItem mediaItem, int reason) {
                        log("onMediaItemTransition reason=" + reason + " mediaItem=" + (mediaItem == null ? "null" : mediaItem.mediaId));
                        updateSnapshot();
                    }

                    @Override
                    public void onPositionDiscontinuity(
                            @NonNull Player.PositionInfo oldPosition,
                            @NonNull Player.PositionInfo newPosition,
                            int reason) {
                        log(
                                "onPositionDiscontinuity reason="
                                        + reason
                                        + " oldPositionMs="
                                        + oldPosition.positionMs
                                        + " newPositionMs="
                                        + newPosition.positionMs);
                        updateSnapshot();
                    }

                    @Override
                    public void onPlaybackStateChanged(int playbackState) {
                        log("onPlaybackStateChanged state=" + playbackState);
                        if (playbackState == Player.STATE_ENDED
                                && player != null
                                && player.getRepeatMode() == Player.REPEAT_MODE_OFF) {
                            stopPlaybackAndService();
                            return;
                        }

                        updateSnapshot();
                    }

                    @Override
                    public void onIsPlayingChanged(boolean isPlaying) {
                        log("onIsPlayingChanged isPlaying=" + isPlaying);
                        if (isPlaying) {
                            scheduleSnapshotTicker();
                        } else {
                            snapshotHandler.removeCallbacks(snapshotTicker);
                        }
                        updateSnapshot();
                    }

                    @Override
                    public void onShuffleModeEnabledChanged(boolean shuffleModeEnabled) {
                        log("onShuffleModeEnabledChanged shuffleModeEnabled=" + shuffleModeEnabled);
                        updateSnapshot();
                    }

                    @Override
                    public void onRepeatModeChanged(int repeatMode) {
                        log("onRepeatModeChanged repeatMode=" + repeatMode);
                        updateSnapshot();
                    }

                    @Override
                    public void onPlayerError(@Nullable PlaybackException error) {
                        NativeDownloadedPlaybackService.this.error(error);
                        lastErrorMessage = error == null ? "" : error.getMessage();
                        updateSnapshot();
                    }
                });
        mediaSession =
                new MediaSession.Builder(this, player)
                        .setSessionActivity(createSessionActivity())
                        .build();
        log("mediaSession created");
    }

    private PendingIntent createSessionActivity() {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("smartmusicorganizer://player"), this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        return createPendingIntentForActivity(intent, REQUEST_CODE_CONTENT);
    }

    private PendingIntent createServiceActionPendingIntent(int requestCode, String action) {
        Intent intent = new Intent(this, NativeDownloadedPlaybackService.class);
        intent.setAction(action);
        return createPendingIntentForService(intent, requestCode);
    }

    private PendingIntent createServiceActionPendingIntent(
            int requestCode, String action, long positionMs) {
        Intent intent = new Intent(this, NativeDownloadedPlaybackService.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_POSITION_MS, positionMs);
        return createPendingIntentForService(intent, requestCode);
    }

    private PendingIntent createPendingIntentForService(Intent intent, int requestCode) {
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getService(this, requestCode, intent, pendingIntentFlags);
    }

    private PendingIntent createPendingIntentForActivity(Intent intent, int requestCode) {
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getActivity(this, requestCode, intent, pendingIntentFlags);
    }

    private void ensureForegroundNotification() {
        log("ensureForegroundNotification");
        createNotificationChannel();
        refreshForegroundNotification(true);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            warn("notification manager unavailable");
            return;
        }

        NotificationChannel existingChannel =
                manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID);
        if (existingChannel != null) {
            return;
        }

        NotificationChannel channel =
                new NotificationChannel(
                        NOTIFICATION_CHANNEL_ID,
                        "Playback",
                        NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Offline playback controls");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private void releasePlayer() {
        log("releasePlayer");
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }

        if (player != null) {
            player.release();
            player = null;
        }
    }

    private void stopForegroundPlaybackAndSelf() {
        log("stopForegroundPlaybackAndSelf");

        snapshotHandler.removeCallbacks(snapshotTicker);

        if (player != null) {
            player.pause();
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }

        stopSelf();
    }

    private void handleIntent(Intent intent) {
        createPlayer();

        String action = intent.getAction();
        log("handleIntent action=" + action);

        if (action == null) {
            warn("handleIntent received null action");
            return;
        }

        if (ACTION_LOAD_QUEUE.equals(action)) {
            handleLoadQueue(intent);
            return;
        }

        if (player == null) {
            return;
        }

        switch (action) {
            case ACTION_PLAY:
                player.play();
                break;
            case ACTION_PAUSE:
                player.pause();
                break;
            case ACTION_STOP:
                stopPlaybackAndService();
                return;
            case ACTION_NEXT:
                handleNext();
                break;
            case ACTION_PREVIOUS:
                handlePrevious();
                break;
            case ACTION_SEEK_TO:
                long positionMs = Math.max(0L, intent.getLongExtra(EXTRA_POSITION_MS, 0L));
                log(
                        "handleIntent seekTo requestedPositionMs="
                                + positionMs
                                + " currentPositionMs="
                                + player.getCurrentPosition());
                player.seekTo(positionMs);
                snapshotHandler.postDelayed(
                        new Runnable() {
                            @Override
                            public void run() {
                                if (player != null) {
                                    log(
                                            "seekSnapshotRefresh currentPositionMs="
                                                    + player.getCurrentPosition()
                                                    + " playbackState="
                                                    + player.getPlaybackState());
                                }
                                updateSnapshot();
                            }
                        },
                        120L);
                return;
            case ACTION_SET_VOLUME:
                requestedVolume = normalizeVolume(intent.getFloatExtra(EXTRA_VOLUME, 1.0f));
                applyVolume();
                break;
            case ACTION_SET_MUTED:
                muted = intent.getBooleanExtra(EXTRA_MUTED, false);
                applyVolume();
                break;
            case ACTION_SET_SHUFFLE:
                player.setShuffleModeEnabled(intent.getBooleanExtra(EXTRA_SHUFFLE_ENABLED, false));
                break;
            case ACTION_SET_REPEAT_MODE:
                repeatMode = normalizeRepeatMode(intent.getStringExtra(EXTRA_REPEAT_MODE));
                player.setRepeatMode(mapRepeatMode(repeatMode));
                break;
            default:
                break;
        }

        updateSnapshot();
        refreshForegroundNotification(true);
    }

    private void handleLoadQueue(Intent intent) {
        log("handleLoadQueue");
        List<NativeDownloadedPlaybackTrack> tracks;

        synchronized (PENDING_LOCK) {
            tracks = new ArrayList<>(pendingQueueTracks);
            pendingQueueTracks.clear();
        }

        queueTracks = tracks;
        repeatMode = normalizeRepeatMode(intent.getStringExtra(EXTRA_REPEAT_MODE));
        requestedVolume = normalizeVolume(intent.getFloatExtra(EXTRA_VOLUME, 1.0f));
        muted = false;
        lastErrorMessage = "";
        log(
                "queue loaded tracks="
                        + queueTracks.size()
                        + " repeatMode="
                        + repeatMode
                        + " shuffleEnabled="
                        + intent.getBooleanExtra(EXTRA_SHUFFLE_ENABLED, false)
                        + " autoplay="
                        + intent.getBooleanExtra(EXTRA_AUTOPLAY, true));

        if (player == null) {
            warn("handleLoadQueue player unavailable");
            return;
        }

        int startIndex = intent.getIntExtra(EXTRA_START_INDEX, 0);
        log("handleLoadQueue startIndex=" + startIndex + " requestedVolume=" + requestedVolume);
        if (queueTracks.isEmpty()) {
            warn("queue empty, stopping");
            player.clearMediaItems();
            stopPlaybackAndService();
            updateSnapshot();
            return;
        }

        startIndex = clampIndex(startIndex, queueTracks.size());

        List<MediaItem> mediaItems = new ArrayList<>();
        for (NativeDownloadedPlaybackTrack track : queueTracks) {
            if (track == null) {
                warn("encountered null track while building media items");
                continue;
            }
            String trackTitle = normalizeText(track.title, "Unknown Title");
            String trackArtist = normalizeText(track.artist, "");
            String trackAlbum = normalizeText(track.album, "");
            MediaMetadata metadata =
                    new MediaMetadata.Builder()
                            .setTitle(trackTitle)
                            .setDisplayTitle(trackTitle)
                            .setArtist(trackArtist)
                            .setAlbumTitle(trackAlbum)
                            .build();
            mediaItems.add(
                    new MediaItem.Builder()
                            .setMediaId(track.id)
                            .setUri(resolvePlayableUri(track.audioLocalUri))
                            .setMediaMetadata(metadata)
                            .build());
        }

        if (mediaItems.isEmpty()) {
            warn("no playable media items could be built");
            stopPlaybackAndService();
            updateSnapshot();
            return;
        }

        log("handleLoadQueue builtMediaItems=" + mediaItems.size());

        player.setMediaItems(mediaItems, startIndex, 0L);
        player.setShuffleModeEnabled(intent.getBooleanExtra(EXTRA_SHUFFLE_ENABLED, false));
        player.setRepeatMode(mapRepeatMode(repeatMode));
        applyVolume();
        player.prepare();
        log("player prepared startIndex=" + startIndex + " mediaItems=" + mediaItems.size());

        boolean autoplay = intent.getBooleanExtra(EXTRA_AUTOPLAY, true);
        if (autoplay) {
            log("autoplay true, player.play()");
            player.play();
        } else {
            log("autoplay false, player.pause()");
            player.pause();
        }

        updateSnapshot();
    }

    private void stopPlaybackAndService() {
        log("stopPlaybackAndService");
        currentState = NativeDownloadedPlaybackState.unavailable();

        if (player != null) {
            player.pause();
            player.seekTo(0L);
        }

        stopForegroundPlaybackAndSelf();
    }

    private void handleNext() {
        log("handleNext");
        if (player == null || player.getMediaItemCount() == 0) {
            warn("handleNext ignored because player has no media");
            return;
        }

        if (player.hasNextMediaItem()) {
            player.seekToNextMediaItem();
        } else if (player.getRepeatMode() == Player.REPEAT_MODE_ALL) {
            player.seekTo(0, 0L);
        } else {
            stopPlaybackAndService();
        }
    }

    private void handlePrevious() {
        log("handlePrevious");
        if (player == null || player.getMediaItemCount() == 0) {
            warn("handlePrevious ignored because player has no media");
            return;
        }

        if (player.hasPreviousMediaItem()) {
            player.seekToPreviousMediaItem();
        } else if (player.getRepeatMode() == Player.REPEAT_MODE_ALL) {
            player.seekTo(player.getMediaItemCount() - 1, 0L);
        }
    }

    private void applyVolume() {
        log("applyVolume muted=" + muted + " requestedVolume=" + requestedVolume);
        if (player == null) {
            warn("applyVolume ignored because player is null");
            return;
        }

        player.setVolume(muted ? 0.0f : requestedVolume);
    }

    private void updateSnapshot() {
        if (player == null) {
            log("updateSnapshot player=null");
            currentState = NativeDownloadedPlaybackState.unavailable();
            refreshForegroundNotification(false);
            return;
        }

        String currentTrackId = "";
        int currentIndex = player.getCurrentMediaItemIndex();
        if (currentIndex >= 0 && currentIndex < queueTracks.size()) {
            currentTrackId = queueTracks.get(currentIndex).id;
        }

        currentState =
                NativeDownloadedPlaybackState.fromPlayer(
                        player,
                        queueTracks.size(),
                        currentTrackId,
                        requestedVolume,
                        muted,
                        repeatMode,
                        lastErrorMessage);
        log(
                "snapshot available="
                        + currentState.available
                        + " active="
                        + currentState.active
                        + " isPlaying="
                        + currentState.isPlaying
                        + " state="
                        + player.getPlaybackState()
                        + " currentIndex="
                        + currentState.currentIndex
                        + " queueSize="
                        + currentState.queueSize
                        + " error="
                        + currentState.errorMessage);
        refreshForegroundNotification(false);
    }

    private void scheduleSnapshotTicker() {
        snapshotHandler.removeCallbacks(snapshotTicker);

        if (player != null && player.isPlaying()) {
            snapshotHandler.postDelayed(snapshotTicker, 1000L);
        }
    }

    private static int mapRepeatMode(String value) {
        if ("track".equals(value)) {
            return Player.REPEAT_MODE_ONE;
        }

        if ("playlist".equals(value)) {
            return Player.REPEAT_MODE_ALL;
        }

        return Player.REPEAT_MODE_OFF;
    }

    private static int clampIndex(int value, int size) {
        if (size <= 0) {
            return -1;
        }

        return Math.min(Math.max(value, 0), size - 1);
    }

    private static String normalizeRepeatMode(@Nullable String value) {
        if ("track".equals(value) || "playlist".equals(value)) {
            return value;
        }

        return "off";
    }

    private static float normalizeVolume(float value) {
        if (Float.isNaN(value) || Float.isInfinite(value)) {
            return 1.0f;
        }

        if (value < 0.0f) {
            return 0.0f;
        }

        if (value > 1.0f) {
            return 1.0f;
        }

        return value;
    }

    private static String normalizeText(@Nullable String value, String fallback) {
        if (value == null) {
            return fallback;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private void refreshForegroundNotification(boolean force) {
        String title = "Smart Music Organizer";
        String text = "Preparing offline playback";
        NativeDownloadedPlaybackTrack track = getCurrentTrackForNotification();
        boolean playing = player != null && player.isPlaying();
        int notificationIndex =
                player != null ? player.getCurrentMediaItemIndex() : currentState.currentIndex;

        if (track != null) {
            title = normalizeText(track.title, title);
            text = normalizeText(track.artist, normalizeText(track.album, ""));
        }

        String notificationKey =
                title
                        + "|"
                        + text
                        + "|"
                        + playing
                        + "|"
                        + notificationIndex;

        if (!force && notificationKey.equals(lastForegroundNotificationKey)) {
            return;
        }

        lastForegroundNotificationKey = notificationKey;
        log("refreshForegroundNotification title=" + title + " text=" + text);

        RemoteViews contentView =
                new RemoteViews(getPackageName(), R.layout.notification_playback_compact);
        contentView.setTextViewText(R.id.notification_track_title, title);
        contentView.setTextViewText(R.id.notification_track_subtitle, text);
        contentView.setOnClickPendingIntent(
                R.id.notification_track_container, createSessionActivity());
        contentView.setOnClickPendingIntent(
                R.id.notification_prev_button,
                createServiceActionPendingIntent(REQUEST_CODE_PREVIOUS, ACTION_PREVIOUS));
        contentView.setOnClickPendingIntent(
                R.id.notification_play_button,
                createServiceActionPendingIntent(
                        REQUEST_CODE_PLAY_PAUSE,
                        playing ? ACTION_PAUSE : ACTION_PLAY));
        contentView.setOnClickPendingIntent(
                R.id.notification_next_button,
                createServiceActionPendingIntent(REQUEST_CODE_NEXT, ACTION_NEXT));

        contentView.setImageViewResource(
                R.id.notification_prev_button, android.R.drawable.ic_media_previous);
        contentView.setImageViewResource(
                R.id.notification_play_button,
                playing
                        ? android.R.drawable.ic_media_pause
                        : android.R.drawable.ic_media_play);
        contentView.setImageViewResource(
                R.id.notification_next_button, android.R.drawable.ic_media_next);

        if (text == null || text.isEmpty()) {
            contentView.setViewVisibility(R.id.notification_track_subtitle, View.GONE);
        } else {
            contentView.setViewVisibility(R.id.notification_track_subtitle, View.VISIBLE);
        }

        Notification notification =
                new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentIntent(createSessionActivity())
                        .setColor(ContextCompat.getColor(this, R.color.notification_playback_accent))
                        .setColorized(true)
                        .setCustomContentView(contentView)
                        .setCustomBigContentView(contentView)
                        .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                        .setVisibility(Notification.VISIBILITY_PUBLIC)
                        .setOngoing(true)
                        .setSilent(true)
                        .setOnlyAlertOnce(true)
                        .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                        .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    @Nullable
    private NativeDownloadedPlaybackTrack getCurrentTrackForNotification() {
        if (queueTracks.isEmpty()) {
            return null;
        }

        int currentIndex = currentState == null ? -1 : currentState.currentIndex;
        if (currentIndex < 0 || currentIndex >= queueTracks.size()) {
            return null;
        }

        return queueTracks.get(currentIndex);
    }

    private Uri resolvePlayableUri(String audioLocalUri) {
        if (audioLocalUri == null) {
            warn("resolvePlayableUri received null path");
            return Uri.EMPTY;
        }

        String normalized = audioLocalUri.trim().replace('\\', '/');
        if (normalized.isEmpty()) {
            warn("resolvePlayableUri received empty path");
            return Uri.EMPTY;
        }

        Uri parsed = Uri.parse(normalized);
        String scheme = parsed.getScheme();

        if ("file".equals(scheme) || "content".equals(scheme) || "http".equals(scheme) || "https".equals(scheme)) {
            log("resolvePlayableUri returning parsed uri scheme=" + scheme);
            return parsed;
        }

        File rootDir = getFilesDir();
        File file = new File(rootDir, normalized);
        log("resolvePlayableUri using app files dir path=" + file.getAbsolutePath());
        return Uri.fromFile(file);
    }
}
