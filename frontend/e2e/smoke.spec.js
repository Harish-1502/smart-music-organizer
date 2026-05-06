import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
    test("app loads and shows main navigation", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByText("Smart Music")).toBeVisible();
        await expect(page.getByRole("link", { name: /library/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /playlists/i })).toBeVisible();
    });

    test("library route loads", async ({ page }) => {
        await page.goto("/library");

        await expect(page).toHaveURL(/\/library/);
        await expect(page.getByRole("link", { name: /library/i })).toBeVisible();
    });

    test("playlists route loads", async ({ page }) => {
        await page.goto("/playlists");

        await expect(page).toHaveURL(/\/playlists/);
        await expect(
            page.getByRole("heading", { name: "Playlists", level: 1 })
        ).toBeVisible();
    });

    test("player route loads empty or restored state", async ({ page }) => {
        await page.goto("/player");

        await expect(page).toHaveURL(/\/player/);

        const emptyState = page.getByRole("heading", { name: /nothing playing/i });
        const nowPlaying = page.getByText(/now playing/i);

        await expect(emptyState.or(nowPlaying)).toBeVisible();
    });

    test("navigation between main pages works", async ({ page }) => {
        await page.goto("/");

        await page.getByRole("link", { name: /playlists/i }).click();
        await expect(page).toHaveURL(/\/playlists/);

        await page.getByRole("link", { name: /library/i }).click();
        await expect(page).toHaveURL(/\/library/);
    });
});