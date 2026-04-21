import { useEffect, useState } from "react";
import { getArtists, getAlbums } from "../api/libraryApi";

export default function useLibraryViews({ setMessage }) {
  const [viewMode, setViewMode] = useState("tracks");
  const [artists, setArtists] = useState([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  async function loadArtists() {
    setArtistsLoading(true);
    try {
      const data = await getArtists();
      setArtists(data || []);
    } catch (error) {
      console.error("LOAD ARTISTS ERROR:", error);
      setMessage(error.message || "Failed to load artists");
    } finally {
      setArtistsLoading(false);
    }
  }

  async function loadAlbums() {
    setAlbumsLoading(true);
    try {
      const data = await getAlbums();
      setAlbums(data || []);
    } catch (error) {
      console.error("LOAD ALBUMS ERROR:", error);
      setMessage(error.message || "Failed to load albums");
    } finally {
      setAlbumsLoading(false);
    }
  }

  useEffect(() => {
    if (viewMode === "artists") {
      loadArtists();
    } else if (viewMode === "albums") {
      loadAlbums();
    }
  }, [viewMode]);

  return {
    viewMode,
    setViewMode,
    artists,
    artistsLoading,
    albums,
    albumsLoading,
    loadArtists,
    loadAlbums,
  };
}