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

## Execution Flow: Download Playlist

User taps "download for offline" on a playlist inside the playlist detail page
  ↓
`handleDownloadForOffline()` starts a multi-track offline job
  ↓
Each track is verified to check if it should be downloaded for a PC or for an android 
  ↓
`downloadPlaylistTracks()` is called and it checks the track is already downloaded(if the track was already downloaded from another downloaded playlist)
  ↓
Missing tracks are downloaded and saved locally
  ↓
Playlist metadata and track relationships are stored for offline browsing
  ↓
`DownloadedPage.jsx` and offline playlist sources read the saved playlist data

## Execution Flow: Download Full Library

User starts a full library download
  ↓
`handleDownloadFullLibrary()` checks if the app is in lan mode and if it's not already downloading before calling the `downloadFullLibraryForOffline()` service
  ↓
`downloadFullLibraryForOffline()` checks sets up all the tracks for the full download and verified each one if it's already downloaded
  ↓
Missing tracks are downloaded one by one
  ↓
Progress state is updated during the run
  ↓
The final result includes counts for downloaded, skipped, failed, and verified tracks

## Execution Flow: Offline Playback

User opens a downloaded track or clicks "Play Offline" in the downloaded page
  ↓
The click is handled in `handlePlayOffline(playlistId)` and builds the queue in `buildOfflinePlaybackQueue()` 
  ↓
Each track's URI in the queue is selected based on the type of storage the app is using. 
  ↓
The player uses that URI for playback queue
  ↓
If the app is running on Android and the queue is fully downloaded, native playback can take over. It's not the browser native playback would take over

## Execution Flow: Delete Downloaded Media

Browser Path: 

User clicks “Delete Download” and confirms
↓
handleDeletePlaylist(playlistId) calls deleteOfflinePlaylist(playlistId)
↓
deleteOfflinePlaylist() normalizes the ID. When shouldUseMobileOfflineSqlite() returns false, it calls deleteDownloadedPlaylist(normalizedPlaylistId)
↓
deleteDownloadedPlaylist() gets the database using getOfflineDatabase() and opens a read/write transaction for playlists, tracks, audio blobs, and artwork blobs
↓
playlistStore.get(normalizedPlaylistId) loads the playlist, and its track IDs are collected
↓
playlistStore.delete(normalizedPlaylistId) deletes the playlist
↓
For each track, trackStore.get(trackId) loads its metadata. The deleted playlist’s ID is removed from track.playlistIds
↓
If other playlist IDs remain, trackStore.put() saves the updated memberships. Otherwise, trackStore.delete(track.id) removes the track’s metadata
↓
cleanupUnreferencedBlobs() collects blob IDs used by remaining tracks, then deletes unreferenced audio and artwork blobs
↓
await tx.done waits for the transaction to finish, then deleteDownloadedPlaylist() returns true
↓
handleDeletePlaylist() calls reloadOfflineData(), displays the success message using showSuccessMessage?.(), and calls onStorageChanged?.()

Mobile path: 

User clicks “Delete Download” for a downloaded playlist
↓
handleDeletePlaylist(playlistId) asks for confirmation using window.confirm(buildDeleteDownloadConfirmationText(...))
↓
If confirmed, it calls deleteOfflinePlaylist(playlistId)
↓
deleteOfflinePlaylist() normalizes the ID using normalizeOfflineId(). When shouldUseMobileOfflineSqlite() returns true, it follows the mobile path
↓
withMobileOfflineTransaction() starts the SQLite transaction
↓
database.query() reads the playlist’s track IDs from offline_playlist_tracks and saves them in trackIds before deleting the relationships
↓
database.run() deletes the playlist’s download record from offline_downloads, its relationships from offline_playlist_tracks, and its metadata from offline_playlists
↓
For each saved track ID, database.query() counts its remaining relationships in offline_playlist_tracks
↓
If remainingCount > 0, continue preserves the track because another downloaded playlist still uses it
↓
Otherwise, database.run() deletes the track’s records from offline_media_files, offline_downloads, and offline_tracks. deletedTrackIds.push(trackId) records its ID for file cleanup
↓
The transaction finishes successfully and returns { deletedTrackIds }
↓
bestEffortDeleteNativeTrackFiles(deletedTrackIds) calls deleteAudioFile(trackId) and deleteArtworkFile(trackId) for each removed track. Individual file-deletion errors are caught
↓
deleteOfflinePlaylist() returns true
↓
handleDeletePlaylist() calls reloadOfflineData() to refresh the downloaded view
↓
showSuccessMessage?.("Downloaded playlist removed.") displays confirmation, then onStorageChanged?.() calls the optional storage-change callback

## Execution Flow: App Restart And Recovery

User opens the Downloaded page after restarting the app
  ↓
The mount effect in useDownloadedStorageController() calls loadOfflineData()
  ↓
loadOfflineData() sets loading to true and clears previous feedback
  ↓
It calls getOfflineStorageSummary(), then getOfflinePlaylists()
  ↓
On Android, the repository calls ensureMobileOfflineDbReady() to initialize and verify the SQLite database before reading saved data

Success branch:
  ↓
The storage reads return the saved summary and downloaded playlists
  ↓
If the page is still mounted, setSummary(nextSummary) updates the summary
  ↓
setPlaylists(sortPlaylistsByDownloadedDate(nextPlaylists)) updates the playlist list
  ↓
The finally block calls setIsStorageLoading(false)
  ↓
The Downloaded page displays the recovered local data

Failure branch:
  ↓
If Android database readiness fails, the repository throws OfflineDatabaseUnavailableError
  ↓
The catch block sets the summary to available: false with zero counts and calls setPlaylists([])
  ↓
showErrorMessage() displays recovery guidance
  ↓
The finally block calls setIsStorageLoading(false)
  ↓
The page shows storage unavailable; saved downloads are not deleted

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
  - Public entry point that re-exports offline storage and service operations.
  - Preserves existing caller imports; implementations live in the modules below.

- `frontend/src/features/offline/storage/repository/offlineMetadataUtils.js`
  - Primitive normalization for IDs, text, numbers, timestamps, and statuses.

- `frontend/src/features/offline/storage/repository/offlineMetadata.js`
  - Normalizes metadata, sanitizes database rows, and validates stored local references.

- `frontend/src/features/offline/storage/repository/offlineErrors.js`
  - Defines shared error classes and sanitizes and logs metadata failures.

- `frontend/src/features/offline/storage/repository/offlineDbHelpers.js`
  - Selects native storage and provides database readiness, query, transaction, and SQL value helpers.

- `frontend/src/features/offline/storage/repository/offlineTrackRepository.js`
  - Reads individual tracks and saves native track metadata and media references.

- `frontend/src/features/offline/storage/repository/offlinePlaylistRepository.js`
  - Reads playlists and ordered tracks, and saves playlist metadata and membership.

- `frontend/src/features/offline/storage/repository/offlinePlaylistPersistence.js`
  - Atomically records a completed native playlist download and cleans up removed track files after commit.

- `frontend/src/features/offline/storage/repository/offlineCleanup.js`
  - Deletes playlists, preserves tracks shared with other playlists, and clears offline data.
  - Deletes native files only after the metadata transaction commits.

- `frontend/src/features/offline/storage/repository/offlineStorageHealth.js`
  - Verifies saved audio files and calculates storage counts, sizes, and missing-file totals.

- `frontend/src/features/offline/services/offlineLibraryView.js`
  - Prepares downloaded tracks for library browsing and applies demo masking.

- `frontend/src/features/offline/services/offlinePlayback.js`
  - Resolves native and browser playback sources and builds ordered offline queues.

- `frontend/src/features/offline/services/offlineDiagnostics.js`
  - Produces detailed playlist reports comparing saved references with physical media files.

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
  - Exposes operations that persist a device-local copy of backend-derived metadata.
  - Track and playlist persistence is implemented in `storage/repository/`.

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

- preserve public exports in `mobileOfflineRepository.js` when changing extracted implementations
- extracted modules should import dependencies directly rather than importing through `mobileOfflineRepository.js`
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
