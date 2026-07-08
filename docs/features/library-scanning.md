# Feature: Library

## Purpose

The purpose of the Library feature is to allow the user to scan music folders, display them in a table and allow the user to edit them without affecting the actual audio file.

## User Flow

What the user sees:
  - An input box for where the selected music folder would be in
  - A table of all the tracks currently inserted into the database (title, artist, album, filename)
  - Each track as an edit button which shows a window to allow the user to edit title, artist, album, add art, and tags.
  - The track table has a filter section to allow the user to search for tracks based on title, artist and album. They can also change the order fo which the tracks are displayed
  - The bottom of the track table there are a next and prev buttons to allow for navigation in the table

## Execution Flow

User action
  ↓
Frontend page/component
  ↓
Frontend API/helper/storage function
  ↓
Backend route
  ↓
Backend service/database/filesystem
  ↓
Response/result
  ↓
Frontend state update
  ↓
UI changes

## Frontend Implementation

Important files:

- `frontend/src/pages/LibraryPage.jsx`

Explain what each file does.

- `frontend/src/hooks/useLibraryViews.js`
  - 
- `frontend/src/hooks/useTrackBrowser.js`
- `frontend/src/library/librarySource.js`
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