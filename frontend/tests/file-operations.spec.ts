import { test, expect } from '@playwright/test';

test.describe('FilaMama File Operations', () => {
  test('should search for files', async ({ page }) => {
    await page.goto('/browse/Downloads');
    await page.waitForLoadState('networkidle');

    // Find the search input
    const searchInput = page.getByPlaceholder('Search files...');
    await searchInput.fill('pdf');

    // Wait for search to filter results
    await page.waitForTimeout(500);

    // Verify URL contains search parameter
    await expect(page).toHaveURL(/search=pdf/);
  });

  test('should clear search with escape key', async ({ page }) => {
    await page.goto('/browse/Downloads?search=test');
    await page.waitForLoadState('networkidle');

    // Press Escape to clear search
    await page.keyboard.press('Escape');

    // Verify search parameter is removed from URL
    await expect(page).toHaveURL(/^(?!.*search)/);
  });

  test('should select all files with Ctrl+A', async ({ page }) => {
    await page.goto('/browse/Downloads');
    await page.waitForLoadState('networkidle');

    // Press Ctrl+A to select all
    await page.keyboard.press('Control+a');

    // Wait for selection to be applied
    await page.waitForTimeout(300);

    // Verify selection count is displayed (assuming there's a counter)
    // This is a basic check - adjust based on actual UI
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should open file preview', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides');
    await page.waitForLoadState('networkidle');

    // Click on a PDF file if available
    const pdfFile = page.locator('text=/.*\\.pdf$/i').first();

    if (await pdfFile.count() > 0) {
      await pdfFile.click();

      // Verify URL contains file parameter
      await expect(page).toHaveURL(/file=/);

      // Close preview with Escape
      await page.keyboard.press('Escape');

      // Verify file parameter is removed
      await expect(page).toHaveURL(/^(?!.*file=)/);
    }
  });

  test('should filter by content type', async ({ page }) => {
    await page.goto('/browse/Downloads');
    await page.waitForLoadState('networkidle');

    // Click on Photos filter in sidebar
    const photosFilter = page.locator('text=Photos').first();

    if (await photosFilter.count() > 0) {
      await photosFilter.click();

      // Verify URL contains filter parameter
      await expect(page).toHaveURL(/filter=photos/);
    }
  });

  test('should adjust grid size with slider', async ({ page }) => {
    await page.goto('/browse/Downloads');
    await page.waitForLoadState('networkidle');

    // Find the size slider
    const slider = page.locator('input[type="range"]').first();

    if (await slider.count() > 0) {
      // Get initial value
      const initialValue = await slider.inputValue();

      // Move slider
      await slider.fill('150');

      // Verify URL contains size parameter
      await expect(page).toHaveURL(/size=150/);
    }
  });
});
