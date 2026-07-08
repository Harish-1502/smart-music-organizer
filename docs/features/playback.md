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

## Execution Flow: Load track for playback

User selects a tracks
            ↓
PlayerPage.jsx renders
            ↓
useTrackBrowser loads track data
            ↓
library source calls API helper
            ↓
backend returns track metadata
            ↓
frontend stores tracks in state
            ↓
TrackBrowser renders track rows

## Frontend Implementation

Important files:

- `frontend/src/pages/PlayerPage.jsx`

- `frontend/src/context/PlayerContext.jsx`
  - 
- `frontend/src/hooks/useAuthenticatedBlobUrl.js`
  - 

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