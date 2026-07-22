# Feature: Playback

## Purpose

The Playback feature allows the user to stream songs that they have scanned in the Library page or downloaded from the server.

This allows the user to play the songs in a queue, shuffle the songs, repeat the same song and move to the next track in the queue or the previous song in the queue.

On Android, downloaded tracks can also play through a native foreground Media3 service so playback can continue in the background with standard media notification and lock-screen controls.

## User Flow

What the user sees:
- Current track being played
- The play, next, previous, shuffle/repeat buttons
- The current track's name, artist and album
- The show queue button to show the current queue
- When the user moves to another page, they will see a mini-player
- On Android for downloaded tracks, the standard media notification and lock-screen controls stay available while playback continues in the background

## Execution Flow

## Playback Execution Flow: Main Spine

User selects a track in Library or Playlist
-> The page calls `playTrack(track)` or `playQueue(tracks, startIndex)` from `usePlayer()`
-> `PlayerContext.jsx` updates `queue`, `currentIndex`, `currentTrack`, and `isPlaying`
-> Changing `currentTrack` triggers the source-resolution flow
-> `PlayerContext.jsx` resolves the track into a playable `streamUrl`
-> `PlayerAudioHost.jsx` gives `streamUrl` to the shared `<audio>` element
-> Changing `streamUrl` triggers the audio-start flow
-> If `isPlaying` is true, the audio element attempts to play
-> The audio element fires browser media events
-> `PlayerPage.jsx`, if mounted, listens to those events and updates the visible UI
-> When the audio ends, `handleEnded()` in `PlayerContext.jsx` decides whether to repeat, play next, or stop

---

## Attached Flow: Source Resolution

Triggered by: `currentTrack` changes in `PlayerContext.jsx`
-> `PlayerContext.jsx` clears old `streamUrl`, `artworkUrl`, and `streamError`
-> It calls `resolveTrackPlaybackSource(currentTrack)` and `resolveTrackArtworkSource(currentTrack)`
-> The resolver checks whether the track is online/backend-based or offline/downloaded
-> If successful, `PlayerContext.jsx` stores the new `streamUrl` and `artworkUrl`
-> This reconnects to the main flow at: `PlayerAudioHost.jsx` gives `streamUrl` to the shared `<audio>` element

---

## Attached Flow: Audio Start

Triggered by: `streamUrl`, `currentTrack`, or `isPlaying` changes
-> `PlayerAudioHost.jsx` checks if `audioRef.current`, `currentTrack`, `streamUrl`, and `isPlaying` exist
-> If they exist, it calls `audioRef.current.play()`
-> The browser attempts to start playback
-> If playback starts, browser media events begin firing
-> This reconnects to the main flow at: `PlayerPage.jsx` listens to audio events and updates UI

---

## Attached Flow: Native Android Downloaded Playback

Triggered by: a downloaded track queue is started inside the Capacitor Android app
-> `PlayerContext.jsx` checks whether the queue is fully downloaded and the runtime is Android
-> If the queue qualifies, `PlayerContext.jsx` switches into native playback mode instead of using the shared HTML audio element
-> `frontend/src/features/player/native/nativeDownloadedPlayback.js` loads the queue into the Capacitor plugin
-> `frontend/android/app/src/main/java/com/harish/smartmusicorganizer/nativeplayback/NativeDownloadedPlaybackService.java` owns the ExoPlayer queue, foreground service, media session, and notification
-> The service streams from local downloaded file URIs and advances the queue itself while playback is active
-> `PlayerAudioHost.jsx` keeps the browser audio element out of the way in native mode so the HTML player does not fight the Android service
-> `usePlayerProgressState.js` reads the native snapshot and interpolates progress from the service timestamp while playback is running
-> When the app returns to the foreground, `PlayerContext.jsx` refreshes the native snapshot so React and the service stay aligned
-> Seek commands are sent to the native service as millisecond positions; React keeps the chosen position visible until the service reports the new one
-> If the queue is not a downloaded Android queue, reconnect to: Audio Start

---

## Attached Flow: Player Page UI Sync

Triggered by: `PlayerPage.jsx` rendering while a track exists
-> `PlayerPage.jsx` reads `audioRef`, `currentTrack`, `streamUrl`, `isPlaying`, queue state, and errors from `usePlayer()`
-> It shows the full player UI: artwork, metadata, controls, progress, volume, and queue
-> It attaches listeners to the same global audio element through `audioRef.current`
-> Browser audio events update page-only UI state such as loading, buffering, current time, duration, volume, mute state, and playback errors
-> This flow does not own the track. It only keeps the visible player page synced with the global audio element

---

## Attached Flow: User Controls

Triggered by: user clicks play, pause, next, previous, stop, shuffle, repeat, volume, seek, or queue item
-> `PlayerPage.jsx` or `MiniPlayer.jsx` calls a player action from `usePlayer()`
-> `PlayerContext.jsx` updates player state or controls the shared `audioRef.current`
-> If the action changes `currentTrack`, reconnect to: Source Resolution
-> If the action only changes play/pause, reconnect to: Audio Start
-> If the action changes seek or volume, the audio element updates directly and `PlayerPage.jsx` syncs the UI from audio events

---

## Attached Flow: Keyboard and MP3 Controller Controls

Triggered by: keyboard shortcut or MP3/media-key button
-> The keyboard or MP3 hook receives the input event
-> The input parser converts it into a shared player command
-> `handlePlayerCommand(command)` calls the matching `PlayerContext.jsx` action
-> If the command is next or previous, reconnect to: Source Resolution
-> If the command is play or pause, reconnect to: Audio Start

---

## Attached Flow: Track End

Triggered by: the audio element fires `ended`
-> `PlayerAudioHost.jsx` calls `handleEnded()` from `PlayerContext.jsx`
-> If repeat mode is `track`, `PlayerContext.jsx` restarts the same audio element
-> Otherwise, it calls `nextTrack()`
-> If another track is selected, reconnect to: Source Resolution
-> If there is no next track and playlist repeat is off, playback stops

---

## Attached Flow: Session Restore and Save

Triggered by: app startup
-> `PlayerContext.jsx` checks localStorage for a saved playback session
-> If valid, it restores queue, current index, current time, shuffle state, and repeat mode
-> This can create a `currentTrack`, which reconnects to: Source Resolution
-> Playback does not automatically start after restore

Triggered by: audio `timeupdate`, queue changes, repeat changes, shuffle changes, or page unload
-> `PlayerContext.jsx` saves the current playback session
-> The saved session can be restored the next time the app opens

## Frontend Implementation

Important files:

### 1. Core State

- `frontend/src/features/player/context/PlayerContext.jsx`
  - Main playback state owner.
  - Builds the shared player API used by the rest of the frontend.
  - Owns queue state, current track selection, `isPlaying`, playback error state, and exported player actions.

- `frontend/src/features/player/controls/playerCommandActions.js`
  - Defines the actual player action functions such as play/pause, next, previous, stop, seek, shuffle, repeat, volume, and mute.
  - This is the main action layer used by `PlayerContext`.

### 2. Audio Runtime

- `frontend/src/features/player/components/PlayerAudioHost.jsx`
  - Owns the shared `<audio>` element behavior.
  - Attempts playback when `isPlaying` and `streamUrl` are ready.
  - Reports play failures back into shared player error state.
  - Connects the audio element `ended` event to `handleEnded()`.
  - In Android native downloaded mode, keeps the HTML audio element paused so the native service owns playback.

- `frontend/src/features/player/context/playbackSourceResolver.js`
  - Converts a track object into a playable playback source and artwork source.
  - Decides between backend streaming, offline blob playback, and native file playback.

- `frontend/src/features/player/hooks/usePlayerTrackSources.js`
  - Loads `streamUrl` and `artworkUrl` for the current track.
  - Clears previous source state when the active track changes.
  - Stores source-loading failures in `streamError`.

- `frontend/src/features/player/native/nativeDownloadedPlayback.js`
  - Capacitor bridge for native Android downloaded playback.
  - Loads downloaded queues, sends play/pause/seek/next/previous commands, and reads the native playback snapshot.

- `frontend/android/app/src/main/java/com/harish/smartmusicorganizer/nativeplayback/NativeDownloadedPlaybackService.java`
  - Foreground Media3 playback service for downloaded tracks on Android.
  - Owns the ExoPlayer queue, media session, notification, queue advancement, seek handling, and native state snapshots.

- `frontend/android/app/src/main/java/com/harish/smartmusicorganizer/nativeplayback/NativeDownloadedPlaybackPlugin.java`
  - Capacitor plugin that bridges the React app to the Android playback service.
  - Translates JS queue and control calls into service commands.

- `frontend/src/features/player/hooks/usePlayerSessionPersistence.js`
  - Restores the playback session from `localStorage` on startup.
  - Saves queue, current track index, current time, shuffle state, and repeat mode.
  - Reapplies restored playback time to the shared audio element.

- `frontend/src/features/player/hooks/usePlayerPlaybackPreferences.js`
  - Loads and persists shuffle and repeat preferences in `localStorage`.

- `frontend/src/features/player/hooks/usePlayerVolumeState.js`
  - Syncs volume and mute state from the shared audio element.
  - Keeps React state aligned with `audio.volume` and `audio.muted`.

### 3. Input / Commands

- `frontend/src/features/player/controls/playerCommandNames.js`
  - Central list of shared player command constants used across keyboard, MP3, and dispatcher logic.

- `frontend/src/features/player/hooks/usePlayerCommandDispatcher.js`
  - Maps shared player commands to the matching player actions.

- `frontend/src/features/player/hooks/usePlayerInputControls.js`
  - Higher-level input wiring hook.
  - Connects keyboard and MP3/media input hooks to the shared command dispatcher.

- `frontend/src/features/player/hooks/useKeyboardPlayerControls.js`
  - Listens for keyboard events and forwards them as shared player commands.

- `frontend/src/features/player/hooks/useMp3ControllerControls.js`
  - Listens for MP3/media-controller style input events and forwards them as shared player commands.

- `frontend/src/features/player/controls/keyboardCommandMap.js`
  - Converts browser keyboard events into shared player commands.

- `frontend/src/features/player/controls/mp3CommandParser.js`
  - Converts MP3/media-controller input events into shared player commands.

### 4. UI

- `frontend/src/features/player/pages/PlayerPage.jsx`
  - Main full-screen player UI.
  - Reads shared player state from `usePlayer()`.
  - Renders artwork, metadata, progress, transport controls, queue panel, and volume controls.

- `frontend/src/features/player/components/MiniPlayer.jsx`
  - Compact always-visible playback UI shown outside the full player page.
  - Uses shared player state and actions for quick transport controls.

- `frontend/src/features/player/components/PlayerNowPlayingCard.jsx`
  - Presentational component for artwork and current track metadata.

- `frontend/src/features/player/components/PlayerTransportControls.jsx`
  - Presentational component for play/pause, next/previous, shuffle, and repeat buttons.

- `frontend/src/features/player/components/PlayerQueuePanel.jsx`
  - Presentational component for showing the active queue and selecting a track from it.

- `frontend/src/features/player/components/PlayerVolumeControls.jsx`
  - Presentational component for mute and volume slider controls.

- `frontend/src/features/player/hooks/useAudioTransportState.js`
  - Tracks page-level transport UI state such as loading, buffering, audio readiness, and visible playback status/error messages.

- `frontend/src/features/player/hooks/usePlayerProgressState.js`
  - Tracks current time, duration, progress percentage, scrubbing behavior, and seek interactions for the player page.

- `frontend/src/features/player/styles/PlayerPage.css`
  - Main playback page styling.

### 5. Shared Helpers / Shared Integration

- `frontend/src/features/player/utils/trackDisplay.js`
  - Shared display helpers for track title, artist, album, and file-name fallbacks.

- `frontend/src/shared/hooks/useAuthenticatedBlobUrl.js`
  - Used by playback UI to load authenticated artwork blob URLs for backend-served art.
  - This is shared infrastructure, but it is part of the playback UI rendering path.

- `frontend/src/App.jsx`
  - Hosts the global player provider and shared playback UI shell.
  - Important because it is where the top-level playback feature is mounted into the app.

## Backend Implementation

Important files:

### 1. App Wiring / Runtime Entry

- `backend/app/main.py`
  - Main FastAPI application entry point.
  - Mounts the playback-related routers and static artwork directory.
  - Enforces API-token auth in LAN mode.
  - Serves the built frontend shell, which matters because the frontend playback UI is mounted through the same app.

### 2. Streaming / Playback Delivery

- `backend/app/routes/playback.py`
  - Main backend playback route.
  - Exposes `GET /tracks/{track_id}/stream`.
  - Resolves the track's audio file path, validates it, checks allowed roots, and returns the audio file as a streamed `FileResponse`.

- `backend/app/core/path_guard.py`
  - Filesystem safety layer used by playback.
  - Prevents path traversal.
  - Validates that resolved audio and artwork files stay inside allowed directories.
  - Checks supported audio and artwork extensions.

- `backend/app/core/auth.py`
  - API-token authentication logic used by playback requests in LAN mode.
  - Accepts Bearer tokens and still supports the legacy `api_token` query parameter fallback.
  - Important because playback and artwork access may be blocked if auth is missing or invalid.

- `backend/app/core/config.py`
  - Defines playback-relevant settings such as LAN mode, API auth token, allowed scan roots, managed artwork directories, and upload size limits.
  - Controls what playback paths and artwork paths are allowed.

### 3. Track Metadata / Artwork Data

- `backend/app/routes/tracks.py`
  - Main track metadata route used by the frontend library and player flows.
  - Returns paginated track data including display title, artist, album, duration, and art path.
  - Exposes `GET /tracks/{track_id}/art` for track artwork and `POST /tracks/{track_id}/art` for artwork uploads.

- `backend/app/schemas/track.py`
  - Defines the serialized track payload returned to the frontend.
  - Important because this shapes the exact metadata fields the playback UI reads, including `display_title`, `display_artist`, `display_album`, `duration`, and `art_path`.

- `backend/app/models/track.py`
  - Main database model for tracks.
  - Stores file path, file name, metadata, duration, artwork path, and analysis fields.
  - This is the source of truth the playback routes read from before resolving actual files.

- `backend/app/services/art.py`
  - Handles track artwork upload and local artwork detection.
  - Validates uploaded image type and size.
  - Stores managed artwork files and updates `track.art_path`.

### 4. Library / Playlist Sources That Feed Playback

- `backend/app/routes/library.py`
  - Scans the filesystem for tracks and exposes the library-side artwork fallback route.
  - Important to playback because the player can only stream tracks that were first scanned and stored in the backend track table.

- `backend/app/routes/playlist.py`
  - Returns playlist detail payloads with ordered tracks, metadata, and `art_path`.
  - Important because playback queues often start from playlist pages, so this route shapes the ordered track data the frontend passes into `playQueue(...)`.

- `backend/app/schemas/library.py`
  - Defines library scan and clear request contracts.
  - Important indirectly because scanning populates the backend track catalog used by playback.

### 5. Security / Path Exposure Rules

- `backend/app/schemas/public_paths.py`
  - Controls whether local file paths and artwork paths are exposed to the frontend.
  - Important because playback behavior and artwork resolution differ depending on whether backend paths are intentionally exposed.

- `backend/tests/test_api_auth.py`
  - Verifies API-token protection behavior.
  - Important for playback because stream and artwork requests depend on this auth path in LAN mode.

- `backend/tests/test_path_guard.py`
  - Verifies the path-safety rules used before streaming audio or serving artwork.

- `backend/tests/test_path_visibility.py`
  - Verifies which local/backend paths are exposed or hidden in API responses.

- `backend/tests/test_library_routes.py`
  - Covers scan/clear and related library route behavior that feeds the playback catalog.

## Database / Storage

### 1. Filesystem Storage

- Audio files on disk
  - The backend does not store audio blobs in the database for normal playback.
  - Instead, scanned tracks point to real audio files on disk through the stored track file path.
  - `backend/app/routes/playback.py` resolves that path and streams the file directly.

- Artwork files on disk
  - Artwork may come from:
    - original local artwork files found near the audio file
    - managed uploaded artwork stored under the backend artwork directory
  - The stored track artwork path points to the artwork file used by the backend artwork routes.

- Managed artwork directory
  - Configured through backend settings.
  - Mounted in FastAPI as `/static/track_art`.
  - Used when artwork is uploaded or managed by the backend.

### 2. Browser Storage

- `localStorage`
  - Stores playback session data:
    - queue snapshot
    - current track index
    - current playback time
    - shuffle state
    - repeat mode
  - Used by `usePlayerSessionPersistence.js` to restore playback state on app reload.

- `localStorage` playback preferences
  - Stores:
    - shuffle enabled
    - repeat mode
  - Used by `usePlayerPlaybackPreferences.js`.

### 3. Offline / Downloaded Storage

- Browser blob/object URLs
  - Used during frontend playback after a source has been resolved.
  - These are runtime playback URLs, not long-term storage.

- IndexedDB / offline blob storage
  - Used for downloaded offline tracks and artwork in offline playback mode.
  - The frontend can resolve offline `audioBlobId` and `artworkBlobId` into playable blob URLs.

- Native mobile file storage
  - In Capacitor/mobile flows, offline audio and artwork may be stored as local device files.
  - The frontend can resolve `audioLocalUri` and `artworkLocalUri` into WebView-playable URLs.

### 4. Security / Exposure Rules

- Local file paths are not always exposed directly
  - Backend serializers can hide or expose local paths depending on app settings.
  - This affects what the frontend receives for file paths, folder paths, and artwork paths.

- Playback file access is guarded
  - Even if a track record exists, the backend still validates:
    - the path resolves safely
    - the file exists
    - the file is inside allowed roots
    - the file extension is supported

### 5. Practical Source Of Truth

- For online/backend playback:
  - backend track metadata plus filesystem audio file

- For playlist playback:
  - playlist ordering plus related track metadata

- For restored playback state:
  - frontend `localStorage`

- For offline playback:
  - frontend offline storage plus stored offline metadata on the track object

## Important State

### 1. Shared Frontend Player State

- `queue`
  - The active playback queue stored in `PlayerContext`.
  - This is the ordered list the player uses for next/previous navigation.

- `currentIndex`
  - The current position inside the active queue.
  - Used to determine which track is active.

- `currentTrack`
  - Derived from `queue[currentIndex]`.
  - This is the current track the player is trying to resolve, display, and play.

- `isPlaying`
  - Shared playback-intent state.
  - Tells the audio host whether playback should currently be active.

- `playbackError`
  - Shared playback-start or media error state.
  - Used when `audio.play()` fails or media events report an error.

### 2. Shared Frontend Runtime State

- `streamUrl`
  - The currently resolved playable audio URL for the active track.
  - This is what the shared audio element actually receives as `src`.

- `artworkUrl`
  - The currently resolved artwork URL for the active track.
  - Used by the full player page and mini-player UI.

- `streamError`
  - Source-resolution failure state.
  - Set when the frontend cannot resolve a playable stream/art source for the active track.

- `audioRef`
  - The single shared audio element reference.
  - This is the actual media runtime object used by the whole frontend.

### 3. Playback Preference State

- `shuffleEnabled`
  - Shared shuffle preference.
  - Affects how the next track is chosen.

- `repeatMode`
  - Shared repeat preference.
  - Controls whether playback repeats the current track, the playlist, or stops.

- `volume`
  - Shared volume state mirrored from the audio element.

- `isMuted`
  - Shared mute state mirrored from the audio element.

### 4. Page-Level UI State

- Player page transport state
  - Loading, buffering, and readiness state from `useAudioTransportState.js`.
  - Only used to keep the full player UI synced with what the audio element is doing.

- Player page progress state
  - Current time, duration, scrubbing state, and progress percentage from `usePlayerProgressState.js`.
  - This is page-level UI state, not the canonical shared playback queue state.

### 5. Backend Source Of Truth

- Track metadata in the backend
  - The backend track record is the source of truth for title, artist, album, duration, artwork path, and audio file path.

- Audio file on disk
  - For backend playback, the real playable source is ultimately the audio file on disk, not just the database metadata.

- Playlist ordering
  - For playlist playback, the playlist ordering data is part of the source of truth for how the queue is constructed.

### 6. Persistence State

- Restored playback session in `localStorage`
  - Stores queue snapshot, current index, playback time, shuffle state, and repeat mode.
  - Used to rebuild player state when the app reloads.

- Stored playback preferences in `localStorage`
  - Stores shuffle and repeat preferences independently from the full session.

- Offline playback metadata
  - For downloaded/offline playback, the track object may also carry:
    - `audioBlobId`
    - `artworkBlobId`
    - `audioLocalUri`
    - `artworkLocalUri`
    - offline flags
  - These fields are part of the playback source-resolution truth for offline mode.

### 7. Practical "What Is The Truth?" Summary

- What track is active?
  - `currentTrack` derived from `queue` and `currentIndex`

- What should the player be doing?
  - `isPlaying`

- What is actually loaded into the audio element?
  - `streamUrl`

- What does the user currently see?
  - shared player state plus page-level transport/progress UI state

- What survives reload?
  - saved playback session and stored playback preferences in `localStorage`

## Tests

### 1. Frontend Playback Runtime Tests

- `frontend/src/features/player/context/playbackSourceResolver.test.js`
  - Verifies that playback source resolution chooses the correct source type.
  - Covers:
    - backend stream playback
    - IndexedDB offline blob playback
    - native offline file playback
    - missing offline audio handling
    - missing offline artwork handling

- `frontend/src/features/player/components/PlayerAudioHost.test.js`
  - Verifies the shared audio host error path.
  - Covers:
    - rejected `audio.play()` promises
    - synchronous `audio.play()` failures
    - reporting playback errors through the shared player error flow

### 2. Frontend Hook-Level Playback Tests

- `frontend/src/features/player/hooks/usePlayerCommandDispatcher.test.js`
  - Verifies shared player commands are mapped to the correct player actions.
  - Covers play/pause, next/previous, volume up/down, and seek forward/backward.

- `frontend/src/features/player/hooks/usePlayerInputControls.test.js`
  - Verifies the higher-level input-controls hook wires keyboard and MP3 input hooks to the shared command dispatcher.

- `frontend/src/features/player/hooks/usePlayerPlaybackPreferences.test.js`
  - Verifies playback preference persistence.
  - Covers:
    - loading shuffle/repeat from `localStorage`
    - writing them back through the preference effects
    - falling back safely when stored repeat mode is invalid

- `frontend/src/features/player/hooks/usePlayerVolumeState.test.js`
  - Verifies volume and mute state sync with the shared audio element.
  - Covers:
    - reading initial audio volume/mute state
    - resetting to defaults when no audio element exists

- `frontend/src/features/player/hooks/usePlayerSessionPersistence.test.js`
  - Verifies playback session restore/save behavior.
  - Covers:
    - restoring a valid saved session
    - applying restored playback time
    - clearing invalid saved sessions
    - saving the hydrated session payload

- `frontend/src/features/player/hooks/usePlayerTrackSources.test.js`
  - Verifies track source loading behavior at the hook level.
  - Covers:
    - resetting source state when the active track changes
    - clearing playback errors before loading
    - successful stream/artwork resolution
    - controlled `streamError` handling
    - revoke cleanup on teardown

### 3. Frontend Feature / Source Tests Related To Playback

- `frontend/src/features/library/sources/backendLibrarySource.test.js`
  - Verifies backend library track loading behavior.
  - Important because playback queues often begin from library-loaded track data.

- `frontend/src/features/library/sources/librarySource.test.js`
  - Verifies source selection for library data.
  - Important because playback can start from different library source modes.

- `frontend/src/features/library/sources/offlineLibrarySource.test.js`
  - Verifies offline library source behavior.
  - Important for downloaded/offline playback flows.

- `frontend/src/features/playlists/sources/backendPlaylistSource.test.js`
  - Verifies backend playlist data loading.
  - Important because playlist playback depends on correctly shaped ordered playlist track data.

- `frontend/src/features/playlists/sources/playlistSource.test.js`
  - Verifies playlist source selection logic.

- `frontend/src/features/playlists/sources/offlinePlaylistSource.test.js`
  - Verifies offline playlist source behavior for playback in offline mode.

- `frontend/src/features/library/pages/LibraryPage.test.js`
  - Verifies the library page wiring around track browsing and playback entry points.

- `frontend/src/features/playlists/pages/PlaylistDetailPage.test.js`
  - Verifies playlist detail page behavior, which is a common playback entry point.

- `frontend/src/features/playlists/pages/PlaylistsPage.test.js`
  - Verifies playlist page behavior related to playback entry/navigation context.

### 4. Backend Playback Delivery Tests

- `backend/tests/test_playback_routes.py`
  - Verifies the backend playback route behavior.
  - Should be treated as the main backend playback-route safety net.

- `backend/tests/test_api_auth.py`
  - Verifies API-token enforcement and allowed auth paths.
  - Important because playback stream and artwork requests depend on this in LAN mode.

- `backend/tests/test_path_guard.py`
  - Verifies path-safety rules used before streaming audio or serving artwork.

- `backend/tests/test_path_visibility.py`
  - Verifies which file paths and artwork paths are exposed or hidden in API responses.
  - Important because frontend playback behavior changes depending on what path information is available.

### 5. Backend Metadata / Artwork / Source Tests

- `backend/tests/test_track_art_routes.py`
  - Verifies track artwork route behavior.
  - Important for the playback UI because artwork display depends on this path.

- `backend/tests/test_track_update_routes.py`
  - Verifies track metadata update behavior.
  - Important because playback UI reads display metadata such as title, artist, and album from backend track data.

- `backend/tests/test_library_routes.py`
  - Verifies scan/clear and related library route behavior.
  - Important because backend playback depends on the library track catalog being populated correctly.

- `backend/tests/test_playlist.py`
  - Verifies playlist behavior and ordering logic.
  - Important because playlist playback depends on ordered track relationships.

- `backend/tests/test_playlist_route_validation.py`
  - Verifies playlist route input validation.
  - Helps protect playlist-based playback flows from invalid queue construction inputs.

### 6. Practical Test Coverage Summary

- What is strongly covered now?
  - frontend playback source resolution
  - shared playback error flow
  - extracted playback hooks
  - playback session persistence
  - playback preferences
  - volume sync
  - command dispatch and input wiring

- What backend areas are covered?
  - playback route behavior
  - path security
  - auth gating
  - artwork routes
  - library and playlist data flows that feed playback

- What is still lighter-weight?
  - full UI integration across `PlayerContext`, `PlayerAudioHost`, and `PlayerPage`
  - real browser event integration for transport/progress UI state
  - end-to-end offline playback across frontend plus device storage layers

## Debugging Checklist

What to check when this feature breaks.

## Change Guide

How to safely modify this feature.

## Reimplementation Checklist

What you would need to rebuild this feature from scratch.
