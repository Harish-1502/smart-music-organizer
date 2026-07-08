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

- `frontend/src/features/player/pages/PlayerPage.jsx`

- `frontend/src/features/player/context/PlayerContext.jsx`
  - 
- `frontend/src/features/player/hooks/useAuthenticatedBlobUrl.js`
  - 
- `frontend/src/features/player/context/playbackSourceResolver.js`

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