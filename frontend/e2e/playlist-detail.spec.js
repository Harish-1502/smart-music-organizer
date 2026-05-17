import { test, expect } from "@playwright/test";

test.describe("Playlist detail", () => {
    test("empty playlist detail page loads", async ({ page }) => {
        const playlistName = `E2E Empty Detail ${Date.now()}`;

        await page.goto("/playlists");

        await page
        .getByRole("button", { name: /\+ create playlist/i })
        .click();

        await page.getByLabel(/playlist name/i).fill(playlistName);
        await page.getByRole("button", { name: /^create$/i }).click();

        await page
        .getByLabel("Playlist library")
        .getByRole("link", { name: `Open ${playlistName}` })
        .click();

        await expect(
        page.getByRole("heading", { level: 1, name: playlistName })
        ).toBeVisible();

        await expect(page.getByText(/this playlist is empty/i)).toBeVisible();
    });

    test("add tracks modal opens from playlist detail", async ({ page }) => {
        const playlistName = `E2E Add Modal ${Date.now()}`;

        await page.goto("/playlists");

        await page
        .getByRole("button", { name: /\+ create playlist/i })
        .click();

        await page.getByLabel(/playlist name/i).fill(playlistName);
        await page.getByRole("button", { name: /^create$/i }).click();

        await page
        .getByLabel("Playlist library")
        .getByRole("link", { name: `Open ${playlistName}` })
        .click();

        await page.getByRole("button", { name: /add tracks/i }).click();

        await expect(
        page.getByRole("dialog")
        ).toBeVisible();
    });
});

test("can add one track to an empty playlist", async ({ page }) => {
    const playlistName = `E2E Add Track ${Date.now()}`;

    await page.goto("/playlists");

    await page.getByRole("button", { name: /\+ create playlist/i }).click();
    await page.getByLabel(/playlist name/i).fill(playlistName);
    await page.getByRole("button", { name: /^create$/i }).click();

    await page
    .getByLabel("Playlist library")
    .getByRole("link", { name: `Open ${playlistName}` })
    .click();

    await expect(page.getByText(/this playlist is empty/i)).toBeVisible();

    await page.getByRole("button", { name: /add tracks/i }).click();

    const dialog = page.getByRole("dialog", { name: /add tracks/i });

    await expect(dialog).toBeVisible();

    const firstCheckbox = dialog.getByRole("checkbox").first();

    await expect(firstCheckbox).toBeVisible();

    const firstTrackRow = firstCheckbox.locator("xpath=ancestor::tr[1]");

    await expect(firstTrackRow).toBeVisible();

    const firstTrackTitle = await firstTrackRow.locator("td").nth(1).innerText();

    await firstCheckbox.check();

    await expect(dialog.getByText("1 selected")).toBeVisible();

    await dialog.getByRole("button", { name: /add selected/i }).click();

    await expect(dialog).toHaveCount(0);

    await expect(
        page.getByRole("heading", { level: 1, name: playlistName })
    ).toBeVisible();

    await expect(page.getByText(firstTrackTitle, { exact: false })).toBeVisible();

    await expect(page.getByText(/this playlist is empty/i)).toHaveCount(0);
});

test("shows an error when adding with no selected tracks", async ({ page }) => {
    const playlistName = `E2E No Selection ${Date.now()}`;

    await page.goto("/playlists");

    await page.getByRole("button", { name: /\+ create playlist/i }).click();
    await page.getByLabel(/playlist name/i).fill(playlistName);
    await page.getByRole("button", { name: /^create$/i }).click();

        await page
        .getByLabel("Playlist library")
        .getByRole("link", { name: `Open ${playlistName}` })
        .click();

    await page.getByRole("button", { name: /add tracks/i }).click();

    const dialog = page.getByRole("dialog", { name: /add tracks/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /add selected/i }).click();

    await expect(
        dialog.getByText(/select at least one track/i)
    ).toBeVisible();

    await expect(dialog).toBeVisible();
});

test("can remove a track from a playlist", async ({ page }) => {
    const playlistName = `E2E Remove Track ${Date.now()}`;

    await page.goto("/playlists");

    await page.getByRole("button", { name: /\+ create playlist/i }).click();
    await page.getByLabel(/playlist name/i).fill(playlistName);
    await page.getByRole("button", { name: /^create$/i }).click();

    await page
    .getByLabel("Playlist library")
    .getByRole("link", { name: `Open ${playlistName}` })
    .click();

    await page.getByRole("button", { name: /add tracks/i }).click();

    const dialog = page.getByRole("dialog", { name: /add tracks/i });
    await expect(dialog).toBeVisible();

    const firstCheckbox = dialog.getByRole("checkbox").first();
    await expect(firstCheckbox).toBeVisible();

    const firstTrackRow = firstCheckbox.locator("xpath=ancestor::tr[1]");
    const firstTrackTitle = await firstTrackRow.locator("td").nth(1).innerText();

    await firstCheckbox.check();
    await dialog.getByRole("button", { name: /add selected/i }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(firstTrackTitle, { exact: false })).toBeVisible();

    const playlistTrackRow = page
        .locator(".playlist-detail-page__track-card")
        .filter({ hasText: firstTrackTitle });

    await expect(playlistTrackRow).toBeVisible();

    await playlistTrackRow.getByRole("button", { name: /remove/i }).click();

    await expect(playlistTrackRow).toHaveCount(0);
    await expect(page.getByText(/this playlist is empty/i)).toBeVisible();
});

test("allows adding the same track twice to a playlist", async ({ page }) => {
    const playlistName = `E2E Duplicate Track ${Date.now()}`;

    await page.goto("/playlists");

    await page.getByRole("button", { name: /\+ create playlist/i }).click();
    await page.getByLabel(/playlist name/i).fill(playlistName);
    await page.getByRole("button", { name: /^create$/i }).click();

    await page
    .getByLabel("Playlist library")
    .getByRole("link", { name: `Open ${playlistName}` })
    .click();
    
    async function addFirstAvailableTrack() {
        await page.getByRole("button", { name: /add tracks/i }).click();

        const dialog = page.getByRole("dialog", { name: /add tracks/i });
        await expect(dialog).toBeVisible();

        const firstCheckbox = dialog.getByRole("checkbox").first();
        await expect(firstCheckbox).toBeVisible();

        const firstTrackRow = firstCheckbox.locator("xpath=ancestor::tr[1]");
        const firstTrackTitle = await firstTrackRow.locator("td").nth(1).innerText();

        await firstCheckbox.check();
        await dialog.getByRole("button", { name: /add selected/i }).click();

        await expect(dialog).toHaveCount(0);

        return firstTrackTitle;
    }

    const firstTrackTitle = await addFirstAvailableTrack();
    await addFirstAvailableTrack();

    const matchingTrackCards = page
        .locator(".playlist-detail-page__track-card")
        .filter({ hasText: firstTrackTitle });

    await expect(matchingTrackCards).toHaveCount(2);
});