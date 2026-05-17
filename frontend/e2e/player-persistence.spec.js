import { test, expect } from "@playwright/test";

async function waitForSavedPlayerSession(page) {
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("smart-music-player-session");
    if (!raw) return false;

    try {
      const session = JSON.parse(raw);
      return (
        Array.isArray(session.queue) &&
        session.queue.length > 0 &&
        Number.isInteger(session.currentIndex) &&
        session.currentIndex >= 0
      );
    } catch {
      return false;
    }
  });
}

test.describe("Player persistence", () => {
  test("restores player session after two refreshes", async ({ page }) => {
    await page.goto("/playlists");

    const firstPlaylist = page.getByLabel("Playlist library").locator("li").first();
    await expect(firstPlaylist).toBeVisible();

    await firstPlaylist.click();

    await expect(page).toHaveURL(/\/playlists\/\d+/);

    const firstTrack = page.locator(".playlist-detail-page__track-card").first();
    await expect(firstTrack).toBeVisible();

    await firstTrack.getByRole("button", { name: /play/i }).click();

    await expect(page.locator(".mini-player")).toBeVisible();

    const miniPlayerTitle = await page.locator(".mini-player__title").innerText();

    await waitForSavedPlayerSession(page);

    await page.reload();

    await expect(page.locator(".mini-player")).toBeVisible();
    await expect(page.locator(".mini-player__title")).toHaveText(miniPlayerTitle);

    await page.reload();

    await expect(page.locator(".mini-player")).toBeVisible();
    await expect(page.locator(".mini-player__title")).toHaveText(miniPlayerTitle);
  });
});

test("does not overwrite a valid restored session with an empty session", async ({ page }) => {
  const fakeSession = {
    version: 1,
    savedAt: Date.now(),
    queue: [
      {
        id: 1,
        track_id: 1,
        playlist_track_id: null,
        title: "Fake Restored Track",
        artist: "E2E Artist",
        album: "E2E Album",
        duration: 180,
      },
    ],
    currentIndex: 0,
    currentTime: 12,
    shuffleEnabled: false,
    repeatMode: "off",
  };

  await page.goto("/");

  await page.evaluate((session) => {
    window.localStorage.setItem(
      "smart-music-player-session",
      JSON.stringify(session)
    );
  }, fakeSession);

  await page.reload();

  await expect(page.locator(".mini-player")).toBeVisible();
  await expect(page.locator(".mini-player__title")).toHaveText(
    "Fake Restored Track"
  );

  const sessionAfterFirstLoad = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-music-player-session"))
  );

  expect(sessionAfterFirstLoad.queue).toHaveLength(1);
  expect(sessionAfterFirstLoad.queue[0].title).toBe("Fake Restored Track");

  await page.reload();

  await expect(page.locator(".mini-player")).toBeVisible();
  await expect(page.locator(".mini-player__title")).toHaveText(
    "Fake Restored Track"
  );

  const sessionAfterSecondLoad = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-music-player-session"))
  );

  expect(sessionAfterSecondLoad.queue).toHaveLength(1);
  expect(sessionAfterSecondLoad.queue[0].title).toBe("Fake Restored Track");
});