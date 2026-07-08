# Feature: Library

## Purpose

The Library feature lets the user browse tracks, artists, and albums that already exist in the app database.

Folder scanning and track editing are launched from the Library page, but they are documented separately.

## User Flow

What the user sees:
    - view tracks in a table/list
    - switch between tracks, artists, and albums
    - search/filter tracks by title, artist, or album
    - change sorting/order
    - navigate through paginated track results
    - select a track for playback
    - open track editing from a track row

## Execution Flow: Load Library Tracks

User opens Library page
  ↓
LibraryPage.jsx renders
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

## Execution Flow: Switch To Artists Or Albums

User clicks Artists or Albums tab
  ↓
LibraryViewTabs changes viewMode
  ↓
useLibraryViews detects viewMode change
  ↓
source.getArtists() or source.getAlbums()
  ↓
frontend stores artists/albums in state
  ↓
ArtistList or AlbumList renders

## Frontend Implementation

Important files:

- `frontend/src/pages/LibraryPage.jsx`

- `frontend/src/hooks/useLibraryViews.js`
  - 
- `frontend/src/hooks/useTrackBrowser.js`
- `frontend/src/library/librarySource.js`
- `frontend/src/library/backendLibrarySource.js`
- `frontend/src/api/libraryApi.js`
- `frontend/src/components/AlbumList.jsx`
- `frontend/src/components/ArtistList.jsx`
- `frontend/src/components/AlbumList.jsx`
- `frontend/src/components/LibraryViewTabs.jsx`
- `frontend/src/components/ScanProgress.jsx`
- `frontend/src/components/TrackBrowser.jsx`

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