# Feature: Playback

## Purpose

The Playback feature allows the user to stream songs that they have scanned in the Library page or downloaded from the server.

This allows the user to play the songs in a queue, shuffle the songs, repeat the same song and move to the next track in the queue or the previous song in the queue.

## User Flow

What the user sees:
    - Current track being played
    - The play, next, previous, shuffle/repeat buttons
    - The current tracks name, artist and album
    - The show queue button to show the current queue
    - When the user moves to another page, they will be a mini-player

## Execution Flow

## Playback Execution Flow: Main Spine

User selects a track in Library or Playlist
↓
The page calls `playTrack(track)` or `playQueue(tracks, startIndex)` from `usePlayer()`
↓
`PlayerContext.jsx` updates `queue`, `currentIndex`, `currentTrack`, and `isPlaying`
↓
Changing `currentTrack` triggers the source-resolution flow
↓
`PlayerContext.jsx` resolves the track into a playable `streamUrl`
↓
`App.jsx` gives `streamUrl` to the global `<audio>` element
↓
Changing `streamUrl` triggers the audio-start flow
↓
If `isPlaying` is true, the audio element attempts to play
↓
The audio element fires browser media events
↓
`PlayerPage.jsx`, if mounted, listens to those events and updates the visible UI
↓
When the audio ends, `handleEnded()` in `PlayerContext.jsx` decides whether to repeat, play next, or stop

---

## Attached Flow: Source Resolution

Triggered by: `currentTrack` changes in `PlayerContext.jsx`
↓
`PlayerContext.jsx` clears old `streamUrl`, `artworkUrl`, and `streamError`
↓
It calls `resolveTrackPlaybackSource(currentTrack)` and `resolveTrackArtworkSource(currentTrack)`
↓
The resolver checks whether the track is online/backend-based or offline/downloaded
↓
If successful, `PlayerContext.jsx` stores the new `streamUrl` and `artworkUrl`
↓
This reconnects to the main flow at: `App.jsx` gives `streamUrl` to the `<audio>` element

---

## Attached Flow: Audio Start

Triggered by: `streamUrl`, `currentTrack`, or `isPlaying` changes
↓
`App.jsx` checks if `audioRef.current`, `currentTrack`, `streamUrl`, and `isPlaying` exist
↓
If they exist, it calls `audioRef.current.play()`
↓
The browser attempts to start playback
↓
If playback starts, browser media events begin firing
↓
This reconnects to the main flow at: `PlayerPage.jsx` listens to audio events and updates UI

---

## Attached Flow: Player Page UI Sync

Triggered by: `PlayerPage.jsx` rendering while a track exists
↓
`PlayerPage.jsx` reads `audioRef`, `currentTrack`, `streamUrl`, `isPlaying`, queue state, and errors from `usePlayer()`
↓
It shows the full player UI: artwork, metadata, controls, progress, volume, and queue
↓
It attaches listeners to the same global audio element through `audioRef.current`
↓
Browser audio events update page-only UI state such as loading, buffering, current time, duration, volume, mute state, and playback errors
↓
This flow does not own the track. It only keeps the visible player page synced with the global audio element

---

## Attached Flow: User Controls

Triggered by: user clicks play, pause, next, previous, stop, shuffle, repeat, volume, seek, or queue item
↓
`PlayerPage.jsx` or `MiniPlayer.jsx` calls a player action from `usePlayer()`
↓
`PlayerContext.jsx` updates player state or controls the shared `audioRef.current`
↓
If the action changes `currentTrack`, reconnect to: Source Resolution
↓
If the action only changes play/pause, reconnect to: Audio Start
↓
If the action changes seek or volume, the audio element updates directly and `PlayerPage.jsx` syncs the UI from audio events

---

## Attached Flow: Keyboard and MP3 Controller Controls

Triggered by: keyboard shortcut or MP3/media-key button
↓
The keyboard or MP3 hook receives the input event
↓
The input parser converts it into a shared player command
↓
`handlePlayerCommand(command)` calls the matching `PlayerContext.jsx` action
↓
If the command is next or previous, reconnect to: Source Resolution
↓
If the command is play or pause, reconnect to: Audio Start

---

## Attached Flow: Track End

Triggered by: the audio element fires `ended`
↓
`App.jsx` calls `handleEnded()` from `PlayerContext.jsx`
↓
If repeat mode is `track`, `PlayerContext.jsx` restarts the same audio element
↓
Otherwise, it calls `nextTrack()`
↓
If another track is selected, reconnect to: Source Resolution
↓
If there is no next track and playlist repeat is off, playback stops

---

## Attached Flow: Session Restore and Save

Triggered by: app startup
↓
`PlayerContext.jsx` checks localStorage for a saved playback session
↓
If valid, it restores queue, current index, current time, shuffle state, and repeat mode
↓
This can create a `currentTrack`, which reconnects to: Source Resolution
↓
Playback does not automatically start after restore

Triggered by: audio `timeupdate`, queue changes, repeat changes, shuffle changes, or page unload
↓
`PlayerContext.jsx` saves the current playback session
↓
The saved session can be restored the next time the app opens

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

- `frontend/src/features/player/context/playbackSourceResolver.js`
  - Converts a track object into a playable playback source and artwork source.
  - Decides between backend streaming, offline blob playback, and native file playback.

- `frontend/src/features/player/hooks/usePlayerTrackSources.js`
  - Loads `streamUrl` and `artworkUrl` for the current track.
  - Clears previous source state when the active track changes.
  - Stores source-loading failures in `streamError`.

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

- `backend/app/...`

Explain what backend code is involved.

## Database / Storage

Tables, browser storage, Capacitor storage, or local files involved.

## Important State

Where the truth lives.

Example:

- backend tracks
- frontend state
- player state
- downloaded metadata
- local audio file URI

## Tests

Relevant tests and what they prove.

## Debugging Checklist

What to check when this feature breaks.

## Change Guide

How to safely modify this feature.

## Reimplementation Checklist

What you would need to rebuild this feature from scratch.
