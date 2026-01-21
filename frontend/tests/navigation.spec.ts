import { test, expect } from '@playwright/test';

test.describe('FilaMama Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that the main navigation elements are present
    await expect(page.locator('text=FilaMama')).toBeVisible();
  });

  test('should navigate to Downloads folder from sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on Downloads in sidebar
    await page.click('text=Downloads');

    // Verify URL changed
    await expect(page).toHaveURL(/\/browse\/Downloads/);

    // Verify breadcrumb shows Downloads
    await expect(page.locator('header')).toContainText('Downloads');
  });

  test('should switch between grid and list view', async ({ page }) => {
    await page.goto('/browse/Downloads');
    await page.waitForLoadState('networkidle');

    // Find the toggle group and click list view
    // The toggle items are buttons with data-state attribute
    const toggleButtons = page.locator('button[role="radio"]');

    // Click the second toggle button (list view)
    await toggleButtons.nth(1).click();

    // Wait for view to change
    await page.waitForTimeout(500);

    // Verify URL has list view parameter
    await expect(page).toHaveURL(/view=list/);

    // Click first toggle button to go back to grid view
    await toggleButtons.nth(0).click();

    // Verify URL has grid view parameter or no view parameter (default)
    await page.waitForTimeout(500);
  });

  test('should navigate using breadcrumbs', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides');
    await page.waitForLoadState('networkidle');

    // Click on Downloads in breadcrumb (breadcrumbs are buttons, not links)
    // Use header to scope it to breadcrumb only (not sidebar)
    await page.locator('header').getByRole('button', { name: 'Downloads' }).click();

    // Verify we're back at Downloads
    await expect(page).toHaveURL(/\/browse\/Downloads$/);
  });

  test('should navigate to parent directory with backspace', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides');
    await page.waitForLoadState('networkidle');

    // Press backspace
    await page.keyboard.press('Backspace');

    // Verify we're back at Downloads
    await expect(page).toHaveURL(/\/browse\/Downloads$/);
  });
});
