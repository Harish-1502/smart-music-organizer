import { getAlbums, getArtists, getTracks } from "../../../api/libraryApi";

export const backendLibrarySource = {
  kind: "backend",

  async getTracks(params = {}) {
    return getTracks(
      params.page ?? 1,
      params.pageSize ?? 25,
      params.search ?? "",
      params.sortBy ?? "title",
      params.order ?? "asc",
      params.artist ?? "",
      params.exactArtist ?? "",
      params.album ?? "",
      params.exactAlbum ?? "",
      params.extension ?? "",
    );
  },

  async getArtists() {
    return getArtists();
  },

  async getAlbums() {
    return getAlbums();
  },

  async getAllTracks(params = {}) {
    const pageSize = Math.min(Math.max(Number(params.pageSize) || 100, 1), 100);
    const firstPage = await this.getTracks({
      ...params,
      page: 1,
      pageSize,
    });
    const items = [...(firstPage?.items || [])];
    const totalPages = Number(firstPage?.total_pages) || 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const pageResult = await this.getTracks({
        ...params,
        page,
        pageSize,
      });
      items.push(...(pageResult?.items || []));
    }

    return {
      ...firstPage,
      items,
      page: 1,
      page_size: pageSize,
      total_items: Number(firstPage?.total_items) || items.length,
      total_pages: totalPages,
    };
  },
};
