# Frontend Guide

The frontend is a React/Vite application responsible for the user interface, music playback controls, playlist workflows, library display, API communication, and mobile/offline UI flows.

The frontend should not directly scan local folders or read arbitrary local files. It communicates with the FastAPI backend through API calls. The backend owns filesystem access, database writes, streaming, artwork serving, path validation, and LAN authentication.

## Frontend Responsibilities

The frontend is responsible for:

* rendering the app UI
* loading library data from the backend
* displaying tracks, playlists, tags, and metadata
* controlling audio playback
* sending playlist and tag changes to the backend
* handling LAN token entry when required
* showing downloaded/offline tracks
* preparing the app for Capacitor Android usage

The frontend is not responsible for:

* scanning local folders directly
* reading arbitrary local paths
* writing to the backend database directly
* validating filesystem security
* streaming files directly from disk
* enforcing backend LAN security

## Frontend Folder Structure

The exact files may change over time, but the frontend is organized around app startup, pages, API helpers, playback state, library sources, and offline/mobile logic.

```text
frontend/
  src/
    main.jsx
    App.jsx
    api/
    pages/
    components/
    player/
    library/
    offline/
```

## App Startup

### `frontend/src/main.jsx`

This is the frontend entry point.

Responsibilities:

* create the React root
* render the app into the browser DOM
* wrap the app in global providers
* attach routing if routing is configured here

Typical startup flow:

```text
Browser loads built frontend
  ↓
main.jsx runs
  ↓
React root is created
  ↓
Global providers are mounted
  ↓
App.jsx is rendered
```

### `frontend/src/App.jsx`

This file usually owns the main app shell.

Responsibilities may include:

* defining main routes
* rendering page layout
* connecting navigation
* deciding which page/component to show
* keeping top-level UI structure consistent

## Pages

Pages represent major user-visible screens.

Common page areas may include:

* library page
* playlist page
* downloaded/offline page
* settings or connection page
* AI playlist page
* tag management page

Pages should focus on user workflows. If a page becomes too large, logic should be moved into smaller components, hooks, API helpers, or feature modules.

## Components

Components are reusable UI pieces used by pages.

Examples may include:

* track rows/cards
* playlist cards
* player controls
* buttons
* modals
* forms
* loading/error displays
* tag chips
* download progress displays

Components should usually receive data through props and avoid owning backend-specific logic directly unless the component is intentionally part of a feature flow.

## API Layer

The API layer is where the frontend talks to the FastAPI backend.

Responsibilities:

* build request URLs
* call backend endpoints
* attach auth token when needed
* parse JSON responses
* handle request errors
* keep backend communication out of UI components when possible

Important concepts:

* local development usually uses `http://127.0.0.1:8000`
* LAN/mobile mode uses the PC's LAN IP address
* Capacitor Android should not use `localhost` for the PC backend
* LAN tokens should be sent through the supported authorization flow, not placed into URLs

Example request flow:

```text
Page/component
  ↓
API helper
  ↓
FastAPI backend endpoint
  ↓
JSON response
  ↓
Page/component updates UI state
```

## Player System

The player system owns frontend playback state and controls.

Responsibilities may include:

* currently selected track
* play/pause state
* queue or playlist context
* next/previous track behavior
* audio element control
* playback progress
* volume or seek behavior

The frontend controls playback, but the backend provides audio through stream routes.

Playback flow:

```text
User selects track
  ↓
Frontend sets active track
  ↓
Player builds stream URL or requests stream source
  ↓
Backend streams audio file
  ↓
Frontend audio player plays the track
```

Detailed playback implementation should be documented in:

```text
docs/features/playback.md
```

## Library System

The library system displays tracks stored in the app database.

Responsibilities may include:

* loading tracks from the backend
* displaying track metadata
* filtering or searching tracks
* selecting tracks for playback
* showing artwork
* handling empty/loading/error states

Library loading flow:

```text
User opens library
  ↓
Frontend requests track/library data
  ↓
Backend returns track metadata
  ↓
Frontend stores result in state
  ↓
Frontend renders track list
```

Detailed library implementation should be documented in:

```text
docs/features/library.md
```

## Playlist UI

Playlist UI handles user workflows around playlists.

Responsibilities may include:

* listing playlists
* creating playlists
* opening playlist details
* adding tracks to playlists
* removing tracks from playlists
* starting playback from a playlist
* showing playlist metadata

The frontend sends playlist changes to the backend. The backend owns database writes and playlist-track relationships.

Detailed playlist implementation should be documented in:

```text
docs/features/playlists.md
```

## Tag UI

Tag UI handles displaying and changing track tags.

Responsibilities may include:

* showing tags on tracks
* adding tags
* removing tags
* displaying inferred tags or suggestions
* supporting tag-based playlist workflows

The backend owns the controlled tag system, tag persistence, and tag inference logic.

Detailed tag implementation should be documented in:

```text
docs/features/tagging-system.md
```

## AI Playlist UI

The AI playlist UI lets the user request playlist generation based on prompt text, metadata, tags, or audio features.

Frontend responsibilities:

* collect the user prompt
* send the request to the backend
* display generated playlist results
* let the user save or play the result

Backend responsibilities:

* interpret the request
* score/select tracks
* use metadata and tags
* return playlist candidates or create playlists

Detailed AI playlist implementation should be documented in:

```text
docs/features/ai-playlists.md
```

## Offline / Mobile UI

Offline/mobile frontend code supports downloaded tracks and mobile playback direction.

Responsibilities may include:

* downloading tracks from the backend
* saving track metadata locally
* showing downloaded tracks
* playing downloaded tracks
* handling download progress
* handling failed downloads
* deleting downloaded tracks

The mobile/offline design should avoid relying only on temporary cache. The goal is to save audio files and enough metadata locally so the app can rebuild the downloaded library.

Detailed offline implementation should be documented in:

```text
docs/features/offline-mobile.md
```

## LAN / Mobile Frontend Behavior

In LAN/mobile mode, the frontend may be opened from another device on the same Wi-Fi network.

Important behavior:

* the backend URL must point to the server computer
* the frontend should ask for the API token at runtime when needed
* API requests should include the token through the supported authorization flow
* media/artwork requests should avoid exposing tokens in URLs
* raw local path exposure should stay disabled for normal LAN use

Detailed LAN behavior should be documented in:

```text
docs/features/lan-mode.md
```

## Frontend State

Frontend state may exist in several places:

| State Type               | Example                                 |
| ------------------------ | --------------------------------------- |
| Local component state    | form inputs, modal state, loading flags |
| Page state               | loaded tracks, playlist details, errors |
| Global player state      | active track, playback status, queue    |
| Offline state            | downloaded tracks, download progress    |
| Runtime connection state | backend URL, LAN token status           |

State should stay as close as possible to where it is used. Shared state should only become global when multiple unrelated parts of the app need it.

## Frontend Request Lifecycle

Most frontend requests follow this pattern:

```text
User action
  ↓
Page/component handler
  ↓
API helper function
  ↓
Backend route
  ↓
Response returned
  ↓
State updated
  ↓
UI re-renders
```

When debugging a frontend feature, trace the flow in this order:

1. Which page/component starts the action?
2. Which handler runs?
3. Which API helper is called?
4. Which backend endpoint is requested?
5. What response shape comes back?
6. Where is state updated?
7. Which component renders the result?

## Safe Frontend Change Rules

When changing frontend code:

1. Start from a real user flow.
2. Find the page/component that owns the flow.
3. Find the API helper it calls.
4. Confirm the backend response shape.
5. Make one small change.
6. Run the app.
7. Test the user flow manually.
8. Run frontend checks if available.
9. Update the related feature doc if behavior changed.

Avoid changing response assumptions without checking the backend route.

Avoid duplicating API request logic across many components.

Avoid putting LAN API tokens into URLs.

Avoid depending on raw local file paths for normal use.

## Debugging Guide

### Frontend page loads but data is missing

Check:

* backend is running
* browser Network tab shows the API request
* request URL is correct
* response status is not `401`, `403`, or `500`
* frontend API base URL is correct
* LAN token is set correctly if LAN mode is enabled

### Track does not play

Check:

* selected track has a valid ID
* stream request is being made
* backend stream route returns success
* LAN token/auth is working if needed
* browser console has no media errors

### Artwork does not show

Check:

* artwork route is requested by track ID
* backend can find artwork
* raw path fallback is not being relied on accidentally
* privacy/path exposure flags are configured correctly

### Mobile app cannot reach backend

Check:

* backend is running in LAN mode
* phone and PC are on the same Wi-Fi network
* frontend uses the PC's LAN IP address
* Android app is not using `localhost`
* API token is correct
* PC firewall allows the connection

## Related Feature Docs

Implementation-level walkthroughs belong in the feature docs:

* `docs/features/library.md`
* `docs/features/library-scanning.md`
* `docs/features/playback.md`
* `docs/features/playlists.md`
* `docs/features/tagging-system.md`
* `docs/features/ai-playlists.md`
* `docs/features/lan-mode.md`
* `docs/features/offline-mobile.md`

This file explains the frontend structure. The feature docs explain how specific user workflows execute through the frontend and backend.