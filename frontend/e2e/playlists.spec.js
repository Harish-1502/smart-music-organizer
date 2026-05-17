import { test, expect } from "@playwright/test";

test.describe("Playlists", () => {
  test("can create and delete a playlist", async ({ page }) => {
    const playlistName = `E2E Playlist ${Date.now()}`;

    await page.goto("/playlists");

    await page
      .getByRole("button", { name: /\+ create playlist/i })
      .click();

    await page.getByLabel(/playlist name/i).fill(playlistName);

    await page.getByRole("button", { name: /^create$/i }).click();

    await expect(
      page
        .getByLabel("Playlist library")
        .getByText(playlistName, { exact: true })
    ).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());

    await page
      .getByRole("group", { name: `Actions for ${playlistName}` })
      .getByRole("button", { name: /^delete$/i })
      .click();

    await expect(
      page
        .getByLabel("Playlist library")
        .getByText(playlistName, { exact: true })
    ).toHaveCount(0);
  });
});

test("can rename a playlist", async ({ page }) => {
  const playlistName = `E2E Rename ${Date.now()}`;
  const newName = `${playlistName} Updated`;

  await page.goto("/playlists");

  await page.getByRole("button", { name: /\+ create playlist/i }).click();
  await page.getByLabel(/playlist name/i).fill(playlistName);
  await page.getByRole("button", { name: /^create$/i }).click();

  await expect(
    page.getByLabel("Playlist library").getByText(playlistName, { exact: true })
  ).toBeVisible();

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toMatch(/enter new playlist name/i);
    dialog.accept(newName);
  });

  await page
    .getByRole("group", { name: `Actions for ${playlistName}` })
    .getByRole("button", { name: /^rename$/i })
    .click();

  await expect(
    page.getByLabel("Playlist library").getByText(newName, { exact: true })
  ).toBeVisible();

  await expect(
    page.getByLabel("Playlist library").getByText(playlistName, { exact: true })
  ).toHaveCount(0);

  // cleanup
  page.once("dialog", (dialog) => dialog.accept());

  await page
    .getByRole("group", { name: `Actions for ${newName}` })
    .getByRole("button", { name: /^delete$/i })
    .click();
});

test("shows an error when creating a duplicate playlist", async ({ page }) => {
  const playlistName = `E2E Duplicate ${Date.now()}`;

  await page.goto("/playlists");

  await page.getByRole("button", { name: /\+ create playlist/i }).click();
  await page.getByLabel(/playlist name/i).fill(playlistName);
  await page.getByRole("button", { name: /^create$/i }).click();

  await expect(
    page.getByLabel("Playlist library").getByText(playlistName, { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: /\+ create playlist/i }).click();
  await page.getByLabel(/playlist name/i).fill(playlistName);
  await page.getByRole("button", { name: /^create$/i }).click();

  await expect(
    page.getByText(/playlist with this name already exists/i)
  ).toBeVisible();

  // cleanup
  await page.getByRole("button", { name: /cancel/i }).click();

  page.once("dialog", (dialog) => dialog.accept());

  await page
    .getByRole("group", { name: `Actions for ${playlistName}` })
    .getByRole("button", { name: /^delete$/i })
    .click();
});

test("clicking a playlist opens its detail page", async ({ page }) => {
  const playlistName = `E2E Open Detail ${Date.now()}`;

  await page.goto("/playlists");

  await page
    .getByRole("button", { name: /\+ create playlist/i })
    .click();

  await page.getByLabel(/playlist name/i).fill(playlistName);
  await page.getByRole("button", { name: /^create$/i }).click();

  await expect(
    page
      .getByLabel("Playlist library")
      .getByText(playlistName, { exact: true })
  ).toBeVisible();

  await page
    .getByLabel("Playlist library")
    .getByRole("link", { name: `Open ${playlistName}` })
    .click();

  await expect(page).toHaveURL(/\/playlists\/\d+/);
});