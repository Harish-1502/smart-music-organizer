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
          lanModeEnabled={lanModeEnabled}
          isLibraryLoading={isLibraryLoading}
          libraryTracksKnown={libraryTracksKnown}
          isLibraryDownloading={isLibraryDownloading}
          libraryProgress={libraryProgress}
          libraryStatus={libraryStatus}
          libraryDatabaseUnavailable={libraryDatabaseUnavailable}
          onDownloadFullLibrary={handleDownloadFullLibrary}
          onCancelFullLibraryDownload={handleCancelFullLibraryDownload}
          formatStorageSize={formatStorageSize}
          buildLibraryTransferSummary={buildLibraryTransferSummary}
          sanitizeLibraryProgressTitle={sanitizeLibraryProgressTitle}
          createOfflineDatabaseUnavailableUiMessage={
            createOfflineDatabaseUnavailableUiMessage
          }
        />

        <DownloadedPlaylistsSection
          isStorageLoading={isStorageLoading}
          summary={summary}
          storageAvailable={storageAvailable}
          hasPlaylists={hasPlaylists}
          playlists={playlists}
          missingAudioWarning={missingAudioWarning}
          message={message}
          messageTone={messageTone}
          onClearAll={handleClearAll}
          onPlayOffline={handlePlayOffline}
          onDeletePlaylist={handleDeletePlaylist}
          formatStorageSize={formatStorageSize}
          formatDownloadedDate={formatDownloadedDate}
        />
      </div>
    </section>
  );
}
