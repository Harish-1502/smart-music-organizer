# Feature: Offline Mobile

## Purpose

The Offline Mobile feature lets the user download tracks, playlists, or the full library to a mobile device so the music can be played without a live connection to the desktop backend.

The goal is not to rely on temporary cache. The app should save real audio files and enough metadata locally to rebuild the downloaded library after restart.

This feature is part of the LAN/mobile direction and supports the Capacitor Android workflow.

## User Flow

What the user sees:
- a Downloaded page that shows saved tracks and playlists
- download buttons on supported track and playlist screens
- progress while tracks are being downloaded
- errors when a download fails or the offline database is unavailable
- delete actions for removing downloaded tracks or playlists
- offline playback controls for downloaded media

## Execution Flow: Download Track

User taps download on a track
  ↓
`downloadTrackForOffline()` starts the offline download flow
  ↓
The app checks whether mobile offline storage should use native SQLite
  ↓
The app downloads the audio file and artwork file if needed
  ↓
`saveOfflineTrackWithMediaRefs()` stores metadata and local file references
  ↓
`DownloadedPage.jsx` can now show the track in the downloaded library

## Execution Flow: Download Playlist

User taps download on a playlist
  ↓
`downloadPlaylist()` starts a multi-track offline job
  ↓
Each track is verified before download
  ↓
Missing tracks are downloaded and saved locally
  ↓
Playlist metadata and track relationships are stored for offline browsing
  ↓
`DownloadedPage.jsx` and offline playlist sources read the saved playlist data

## Execution Flow: Download Full Library

User starts a full library download
  ↓
`downloadLibrary()` loads the backend library list
  ↓
The app verifies what is already available offline
  ↓
Missing tracks are downloaded one by one
  ↓
Progress state is updated during the run
  ↓
The final result includes counts for downloaded, skipped, failed, and verified tracks

## Execution Flow: Offline Playback

User opens a downloaded track
  ↓
The player resolves the track as offline media instead of backend streaming
  ↓
Native file storage returns a playable local URI
  ↓
The player uses that URI for playback
  ↓
If the app is running on Android and the queue is fully downloaded, native playback can take over

## Execution Flow: Delete Downloaded Media

User deletes a downloaded track or playlist
  ↓
The offline repository removes the metadata record
  ↓
Native media files are deleted when they exist
  ↓
The downloaded view updates to reflect the removed item

## Execution Flow: App Restart And Recovery

App opens after a restart
  ↓
Offline storage is initialized
  ↓
The app reads saved metadata and local file references
  ↓
Downloaded tracks and playlists reappear without needing a live backend connection
  ↓
If the offline database cannot be opened, the app shows an unavailable state and recovery guidance

## Frontend Implementation

Important files:

- `frontend/src/features/offline/pages/DownloadedPage.jsx`
  - Main orchestrator for the downloaded page.
  - Composes the storage controller, library controller, page feedback hook, and presentational offline components.

- `frontend/src/features/offline/hooks/useDownloadedStorageController.js`
  - Owns downloaded storage summary state, downloaded playlists state, reload behavior, delete/clear actions, and offline-play entry points.

- `frontend/src/features/offline/hooks/useDownloadedLibraryController.js`
  - Owns LAN-mode full-library status, runtime progress subscription, and full-library download/cancel actions.

- `frontend/src/features/offline/hooks/useDownloadedPageFeedback.js`
  - Owns shared downloaded-page feedback state such as success, warning, and error messages.

- `frontend/src/features/offline/components/DownloadedHero.jsx`
  - Renders the top-level offline storage summary section.

- `frontend/src/features/offline/components/OfflineLibraryCard.jsx`
  - Renders the full-library download UI using page-prepared summary, note, and progress display data.

- `frontend/src/features/offline/components/DownloadedPlaylistsSection.jsx`
  - Renders downloaded-playlist states, status messaging, and the stored-playlists grid.

- `frontend/src/features/offline/components/DownloadedPlaylistCard.jsx`
  - Presentational card for a single downloaded playlist entry.

- `frontend/src/features/offline/components/DownloadedStatusBanner.jsx`
  - Shared status banner for downloaded-page success, warning, and error messaging.

- `frontend/src/features/offline/utils/downloadedPageText.js`
  - Shared formatting and copy helpers for downloaded-page confirmations, labels, and warnings.

- `frontend/src/features/offline/utils/downloadedPageData.js`
  - Shared downloaded-page data helpers for sorting playlists and shaping fallback UI state.

- `frontend/src/features/offline/services/downloadLibrary.js`
  - Handles the full-library offline download flow.
  - Tracks progress, cancellation, and result state.

- `frontend/src/features/offline/services/downloadPlaylist.js`
  - Handles downloading a playlist for offline use.

- `frontend/src/features/offline/services/offlineTrackDownload.js`
  - Handles the low-level track download pipeline.
  - Coordinates file creation, cleanup, and error handling.

- `frontend/src/features/offline/storage/mobileOfflineRepository.js`
  - Main repository for offline metadata and native mobile storage access.
  - Stores and reads downloaded tracks, playlists, and media references.

- `frontend/src/features/offline/storage/mobileSqliteDb.js`
  - Owns the mobile SQLite database setup and readiness checks.

- `frontend/src/features/offline/storage/nativeMediaFileStorage.js`
  - Owns device-local audio and artwork file storage helpers.

- `frontend/src/features/offline/storage/offlineStorage.js`
  - IndexedDB-based offline storage used for web and non-native flows.

- `frontend/src/features/library/sources/offlineLibrarySource.js`
  - Reads downloaded tracks so the Library UI can show offline content.

- `frontend/src/features/playlists/sources/offlinePlaylistSource.js`
  - Reads downloaded playlists for offline playlist browsing and playback.

- `frontend/src/features/player/context/playbackSourceResolver.js`
  - Chooses offline playback sources when a downloaded track is selected.

- `frontend/src/features/player/native/nativeDownloadedPlayback.js`
  - Capacitor bridge for native Android downloaded playback.

## Backend Implementation

Important files:

- `frontend/src/features/offline/services/downloadLibrary.js`
  - Uses backend library data as the source of truth for what can be downloaded.

- `frontend/src/features/offline/storage/mobileOfflineRepository.js`
  - Reads backend-derived metadata and persists a device-local copy of it.

- `frontend/src/features/library/sources/backendLibrarySource.js`
  - Provides the library track list used for full-library download planning.

The backend stays responsible for serving the library metadata and audio files. The offline feature only stores the downloaded result on the device.

## Database / Storage

Storage involved:

- mobile SQLite database for downloaded track and playlist metadata
- native device file storage for downloaded audio and artwork
- IndexedDB or web storage for non-native offline flows

Important rules:

- do not store API tokens in offline metadata
- do not store raw desktop file paths in native mobile metadata
- store enough local refs to rebuild the downloaded library after restart
- keep downloaded audio files and artwork separate from the metadata database

## Important State

Where the truth lives:

- downloaded track metadata in the offline repository
- downloaded playlist metadata in the offline repository
- local audio file URIs and artwork file URIs in native storage metadata
- downloaded-page feedback state in `useDownloadedPageFeedback()`
- downloaded storage summary and downloaded-playlist state in `useDownloadedStorageController()`
- full-library availability, progress, and download state in `useDownloadedLibraryController()`
- offline database readiness state in the storage layer

## Tests

Relevant tests:

- `frontend/src/features/offline/tests/hooks/useDownloadedLibraryController.test.js`
- `frontend/src/features/offline/tests/services/downloadLibrary.test.js`
- `frontend/src/features/offline/tests/services/downloadPlaylist.test.js`
- `frontend/src/features/offline/tests/storage/mobileOfflineRepository.test.js`
- `frontend/src/features/offline/tests/storage/mobileSqliteDb.test.js`
- `frontend/src/features/offline/tests/storage/nativeMediaFileStorage.test.js`
- `frontend/src/features/offline/tests/storage/offlineStorage.test.js`
- `frontend/src/features/offline/tests/pages/DownloadedPage.test.js`

These tests cover download flow behavior, library-controller orchestration, repository storage rules, file storage helpers, and downloaded-page rendering.

## Debugging Checklist

What to check when this feature breaks:

- confirm the app is running in a mode that supports offline downloads
- confirm the mobile offline database can open
- confirm file storage can create and read local media files
- confirm downloaded metadata still matches the saved files
- confirm the downloaded page is reading the right storage source
- confirm Android native playback is only used when the queue is actually downloaded

## Change Guide

How to change this feature safely:

- update the repository layer before changing UI assumptions
- keep metadata shape changes in sync across download, playback, and offline library code
- add or update tests for any new storage field or download step
- avoid persisting sensitive LAN/mobile data in offline records
- preserve the recovery path for missing files and unavailable databases

## Reimplementation Checklist

What would be needed to rebuild this feature from scratch:

- a local metadata store for downloaded tracks and playlists
- a native file store for audio and artwork
- download flows for track, playlist, and library modes
- an offline library page
- offline playback source resolution
- recovery behavior for missing or corrupt offline data
- Android native playback support for downloaded media
