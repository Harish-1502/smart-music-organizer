import { useNavigate } from "react-router-dom";
import { usePlayer } from "../../player/context/PlayerContext";
import DownloadedHero from "../components/DownloadedHero";
import OfflineLibraryCard from "../components/OfflineLibraryCard";
import DownloadedPlaylistsSection from "../components/DownloadedPlaylistsSection";
import { useDownloadedLibraryController } from "../hooks/useDownloadedLibraryController";
import { useDownloadedPageFeedback } from "../hooks/useDownloadedPageFeedback";
import { useDownloadedStorageController } from "../hooks/useDownloadedStorageController";
import {
  buildLibraryTransferSummary,
  formatDownloadedDate,
  formatStorageSize,
  formatStorageType,
  sanitizeLibraryProgressTitle,
} from "../utils/downloadedPageText";
import { createOfflineDatabaseUnavailableUiMessage } from "../utils/downloadedPageData";
import "../styles/DownloadedPage.css";

export {
  buildClearAllDownloadsConfirmationText,
  buildDeleteDownloadConfirmationText,
  getMissingAudioWarningMessage,
  sanitizeLibraryProgressTitle,
} from "../utils/downloadedPageText";

export default function DownloadedPage({
  initialAppMode = null,
  initialSummary = null,
  initialPlaylists = null,
  initialLibraryStatus = null,
  initialLoading = null,
  initialIsLibraryDownloading = false,
  initialLibraryProgress = null,
}) {
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const {
    message,
    messageTone,
    clearMessage,
    setFeedback,
    showSuccessMessage,
    showWarningMessage,
    showErrorMessage,
  } = useDownloadedPageFeedback();
  const {
    summary,
    playlists,
    isStorageLoading,
    hasPlaylists,
    storageAvailable,
    missingAudioWarning,
    reloadOfflineData,
    handleDeletePlaylist,
    handleClearAll,
    handlePlayOffline,
  } = useDownloadedStorageController({
    initialSummary,
    initialPlaylists,
    initialLoading,
    navigate,
    playQueue,
    clearMessage,
    setFeedback,
    showSuccessMessage,
    showWarningMessage,
    showErrorMessage,
  });
  const {
    lanModeEnabled,
    libraryStatus,
    isLibraryLoading,
    isLibraryDownloading,
    libraryProgress,
    libraryTracksKnown,
    libraryDatabaseUnavailable,
    handleDownloadFullLibrary,
    handleCancelFullLibraryDownload,
  } = useDownloadedLibraryController({
    initialAppMode,
    initialLibraryStatus,
    initialLoading,
    initialIsLibraryDownloading,
    initialLibraryProgress,
    onRefreshOfflineData: reloadOfflineData,
    clearMessage,
    showErrorMessage,
  });
  const playlistsSectionState = {
    isStorageLoading,
    hasSummary: Boolean(summary),
    storageAvailable,
    hasPlaylists,
    missingAudioWarning,
  };
  const playlistCards = playlists.map((playlist) => {
    const playlistName = playlist.name || "Untitled playlist";

    return {
      id: playlist.id,
      name: playlistName,
      trackCountLabel: `${playlist.totalTracks ?? 0} tracks`,
      offlineSizeLabel: `Offline size ${formatStorageSize(playlist.totalBytes ?? 0)}`,
      downloadedAtLabel: `Downloaded ${formatDownloadedDate(playlist.downloadedAt)}`,
      statusLabel: "Already downloaded for offline playback.",
      actionLabel: `Actions for ${playlistName}`,
    };
  });
  const offlineLibrarySummaryCards = [
    {
      label: "PC library tracks",
      value: isLibraryLoading ? "..." : libraryTracksKnown,
      compact: false,
    },
    {
      label: "Already downloaded",
      value: isLibraryDownloading
        ? Number(libraryProgress.verifiedExistingCount ?? 0) +
          Number(libraryProgress.downloadedCount ?? 0) +
          Number(libraryProgress.skippedCount ?? 0)
        : isLibraryLoading
          ? "..."
          : libraryStatus?.available
            ? libraryStatus.alreadyDownloadedCount
            : libraryDatabaseUnavailable
              ? "--"
              : 0,
      compact: false,
    },
    {
      label: "New downloads",
      value: isLibraryDownloading
        ? Math.max(
            libraryProgress.totalMissingTracks -
              libraryProgress.processedMissingTracks,
            0,
          )
        : isLibraryLoading
          ? "..."
          : libraryStatus?.available
            ? libraryStatus.missingDownloadCount
            : libraryDatabaseUnavailable
              ? "--"
              : 0,
      compact: false,
    },
    {
      label: "Estimated size",
      value: "Estimated size unavailable",
      compact: true,
    },
  ];
  let offlineLibraryNote = null;

  if (!lanModeEnabled) {
    offlineLibraryNote = "Switch to LAN Mode to download from your PC library.";
  } else if (!isLibraryLoading && libraryDatabaseUnavailable) {
    offlineLibraryNote = createOfflineDatabaseUnavailableUiMessage();
  } else if (
    !isLibraryLoading &&
    !libraryStatus?.available &&
    !libraryDatabaseUnavailable
  ) {
    offlineLibraryNote =
      "Connect to your PC backend in LAN Mode to inspect the full library.";
  } else if (
    !isLibraryLoading &&
    libraryStatus?.available &&
    libraryStatus.totalLibraryTracks === 0
  ) {
    offlineLibraryNote = "No tracks found in your PC library right now.";
  }
  const offlineLibraryProgress = isLibraryDownloading
    ? {
        title: "Downloading full library",
        summary: `${libraryProgress.processedMissingTracks} / ${libraryProgress.totalMissingTracks} missing tracks processed. ${buildLibraryTransferSummary(libraryProgress)} Fetched ${formatStorageSize(libraryProgress.downloadedBytes)} so far.`,
        currentTrack: libraryProgress.currentTrackTitle
          ? `Current track: ${sanitizeLibraryProgressTitle(libraryProgress.currentTrackTitle)}`
          : "",
      }
    : null;

  return (
    <section className="downloaded-page" aria-labelledby="downloaded-title">
      <div className="downloaded-page__inner">
        <DownloadedHero
          summary={summary}
          storageAvailable={storageAvailable}
          formatStorageSize={formatStorageSize}
          formatStorageType={formatStorageType}
        />

        <OfflineLibraryCard
          summaryCards={offlineLibrarySummaryCards}
          noteMessage={offlineLibraryNote}
          progressCard={offlineLibraryProgress}
          lanModeEnabled={lanModeEnabled}
          isLibraryLoading={isLibraryLoading}
          libraryTracksKnown={libraryTracksKnown}
          isLibraryDownloading={isLibraryDownloading}
          libraryProgress={libraryProgress}
          libraryStatus={libraryStatus}
          libraryDatabaseUnavailable={libraryDatabaseUnavailable}
          onDownloadFullLibrary={handleDownloadFullLibrary}
          onCancelFullLibraryDownload={handleCancelFullLibraryDownload}
        />

        <DownloadedPlaylistsSection
          sectionState={playlistsSectionState}
          playlistCards={playlistCards}
          message={message}
          messageTone={messageTone}
          onClearAll={handleClearAll}
          onPlayOffline={handlePlayOffline}
          onDeletePlaylist={handleDeletePlaylist}
        />
      </div>
    </section>
  );
}
