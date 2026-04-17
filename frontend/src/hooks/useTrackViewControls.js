import { useState } from "react";
import { getScanStatus } from "../api/libraryApi";

export default function useTrackViewControls({
    setSearch,
    setAppliedSearch,
    setExtensionFilter,
    setSortBy,
    setOrder,
    setPage,
    setMessage,
    setStatus,
    setViewMode,
    loadTracks,
    loadArtists,
    loadAlbums,
    viewMode,
    page
}) {
    const [artistFilter, setArtistFilter] = useState("");
    const [albumFilter, setAlbumFilter] = useState("");


    function handleArtistClick(artistName) {
        setArtistFilter(artistName);
        setPage(1);
        setViewMode("tracks");
      }
    
      function handleAlbumClick(albumName) {
        setAlbumFilter(albumName);
        setPage(1);
        setViewMode("tracks");
      }
    
      function clearAllFilters() {
        setSearch("");
        setAppliedSearch("");
        setArtistFilter("");
        setAlbumFilter("");
        setExtensionFilter("");
        setSortBy("title");
        setOrder("asc");
        setPage(1);
      }
    
      async function handleRefresh() {
        setMessage("");
        const latestStatus = await getScanStatus();
        setStatus(latestStatus);
    
        if (viewMode === "tracks") {
          if (page !== 1) {
            setPage(1);
          } else {
            await loadTracks(1);
          }
        } else if (viewMode === "artists") {
          await loadArtists();
        } else if (viewMode === "albums") {
          await loadAlbums();
        }
      }

    return {
        artistFilter,
        albumFilter,
        setArtistFilter,
        setAlbumFilter,
        handleArtistClick,
        handleAlbumClick,
        clearAllFilters,
        handleRefresh,
    };
}