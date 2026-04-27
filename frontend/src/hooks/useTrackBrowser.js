import { useEffect, useState } from "react";
import { getTracks } from "../api/libraryApi";

export default function useTrackBrowser() {

    const [tracks, setTracks] = useState([]);
    const [tracksLoading, setTracksLoading] = useState(false);
    const [message, setMessage] = useState("");

    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [search, setSearch] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [order, setOrder] = useState("asc");
    const [sortBy, setSortBy] = useState("title");
    const [extensionFilter, setExtensionFilter] = useState("");

    const [artistFilter, setArtistFilter] = useState("");
    const [albumFilter, setAlbumFilter] = useState("");
    const [exactArtistFilter, setExactArtistFilter] = useState("");
    const [exactAlbumFilter, setExactAlbumFilter] = useState("");

    async function loadTracks(
        currentPage = page,
        currentSearch = appliedSearch,
        currentSortBy = sortBy,
        currentOrder = order,
        currentArtist = artistFilter,
        currentExactArtist = exactArtistFilter,
        currentExactAlbum = exactAlbumFilter,
        currentAlbum = albumFilter,
        currentExtension = extensionFilter
      ) 
      {
        setTracksLoading(true);
        try {
          const data = await getTracks(
            currentPage,
            pageSize,
            currentSearch,
            currentSortBy,
            currentOrder,
            currentArtist,
            currentExactArtist,
            currentAlbum,
            currentExactAlbum,
            currentExtension
          );
    
          // DEBUG
          // console.log("TRACKS FROM API:", data);
    
          setTracks(data.items || []);
          setTotalPages(data.total_pages || 1);
          setTotalItems(data.total_items || 0);
        } catch (error) {
          console.error("LOAD TRACKS ERROR:", error);
          setMessage(error.message || "Failed to load tracks");
        } finally {
          setTracksLoading(false);
        }
      }
    function clearAllFilters() {
        setSearch("");
        setAppliedSearch("");
        setArtistFilter("");
        setAlbumFilter("");
        setExactArtistFilter("");
        setExactAlbumFilter("");
        setExtensionFilter("");
        setSortBy("title");
        setOrder("asc");
        setPage(1);
    }

    function applyArtistClick(artistName) {
        setArtistFilter(artistName);
        setExactArtistFilter(artistName);
        setAlbumFilter("");
        setExactAlbumFilter("");
        setPage(1);
    }
    
    function applyAlbumClick(albumName, artistName) {
        setAlbumFilter(albumName);
        setExactAlbumFilter(albumName);
        setArtistFilter("");
        setExactArtistFilter(artistName || "");
        setPage(1);
    }
    
    useEffect(() => {
        loadTracks();
    }, [
        page,
        appliedSearch,
        sortBy,
        order,
        artistFilter,
        albumFilter,
        exactArtistFilter,
        exactAlbumFilter,
        extensionFilter,
    ]);

    return {
        tracks,
        tracksLoading,
        message,
        setMessage,

        page,
        setPage,
        totalPages,
        totalItems,

        search,
        setSearch,
        appliedSearch,
        setAppliedSearch,

        sortBy,
        setSortBy,
        order,
        setOrder,

        artistFilter,
        setArtistFilter,
        albumFilter,
        setAlbumFilter,
        extensionFilter,
        setExtensionFilter,

        exactArtistFilter,
        exactAlbumFilter,

        loadTracks,
        clearAllFilters,
        applyArtistClick,
        applyAlbumClick,
    };
}