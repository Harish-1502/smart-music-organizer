import { useEffect, useState } from "react";
import { backendLibrarySource } from "../library/backendLibrarySource";

export default function useLibraryViews({
  setMessage,
  source = backendLibrarySource,
}) {
  const [viewMode, setViewMode] = useState("tracks");
  const [artists, setArtists] = useState([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  async function loadArtists() {
    setArtistsLoading(true);
    try {
      const data = await source.getArtists();
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
      const data = await source.getAlbums();
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
  }, [source, viewMode]);

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
