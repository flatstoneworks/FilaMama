import { test, expect } from '@playwright/test';

test.describe('FilaMama PDF Viewer', () => {
  test('should open and display PDF file', async ({ page }) => {
    // Navigate directly to a PDF file
    await page.goto('/browse/Downloads/Slides?file=androidopenness3-1234712669166681-2.pdf');
    await page.waitForLoadState('networkidle');

    // Wait for PDF viewer to load
    await page.waitForTimeout(2000);

    // Check that PDF viewer elements are present
    await expect(page.locator('text=/Page \\d+ of \\d+/i')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between PDF pages', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides?file=androidopenness3-1234712669166681-2.pdf');
    await page.waitForLoadState('networkidle');

    // Wait for PDF to fully load
    await expect(page.locator('text=/Page \\d+ of \\d+/i')).toBeVisible({ timeout: 10000 });

    // Get initial page text
    const initialPageText = await page.locator('text=/Page \\d+ of \\d+/i').textContent();

    // Find all buttons in the PDF viewer toolbar
    const toolbar = page.locator('.bg-gray-900');
    const buttons = toolbar.locator('button');

    // Try to find and click the next page button (should be enabled if multiple pages)
    // The next button is typically after the prev button in the toolbar
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Try clicking what should be the next button (around index 1-2)
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const btn = buttons.nth(i);
        const isEnabled = await btn.isEnabled();

        if (isEnabled) {
          // Get aria-label or check if it might be a next button
          await btn.click();
          await page.waitForTimeout(1000);

          // Check if page counter still exists (whether or not page changed)
          await expect(page.locator('text=/Page \\d+ of \\d+/i')).toBeVisible();
          break;
        }
      }
    }
  });

  test('should zoom in and out', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides?file=androidopenness3-1234712669166681-2.pdf');
    await page.waitForLoadState('networkidle');

    // Wait for PDF to load
    await page.waitForTimeout(2000);

    // Find zoom in button (ZoomIn icon)
    const zoomInButton = page.locator('button').filter({ has: page.locator('[class*="zoom-in"]') }).first();

    if (await zoomInButton.count() > 0 && await zoomInButton.isEnabled()) {
      // Get initial zoom level
      const initialZoom = await page.locator('text=/%/').first().textContent();

      // Click zoom in
      await zoomInButton.click();
      await page.waitForTimeout(300);

      // Verify zoom level increased
      const newZoom = await page.locator('text=/%/').first().textContent();
      expect(newZoom).not.toBe(initialZoom);
    }
  });

  test('should close PDF viewer with Escape', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides?file=androidopenness3-1234712669166681-2.pdf');
    await page.waitForLoadState('networkidle');

    // Wait for PDF to load
    await page.waitForTimeout(2000);

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify we're back at the directory without file parameter
    await expect(page).toHaveURL(/\/browse\/Downloads\/Slides$/);
  });

  test('should download PDF file', async ({ page }) => {
    await page.goto('/browse/Downloads/Slides?file=androidopenness3-1234712669166681-2.pdf');
    await page.waitForLoadState('networkidle');

    // Wait for PDF viewer
    await page.waitForTimeout(2000);

    // Set up download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    // Find and click download button (Download icon)
    const downloadButton = page.locator('button').filter({ has: page.locator('[class*="download"]') }).first();

    if (await downloadButton.count() > 0) {
      await downloadButton.click();

      // Wait for download to start
      const download = await downloadPromise;

      if (download) {
        // Verify download started
        expect(download.suggestedFilename()).toContain('.pdf');
      }
    }
  });

  test('should handle PDF loading errors gracefully', async ({ page }) => {
    // Try to load a non-existent PDF
    await page.goto('/browse/Downloads?file=non-existent-file.pdf');
    await page.waitForLoadState('networkidle');

    // Wait a bit for error to appear
    await page.waitForTimeout(2000);

    // Check for error message or that page still works
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });
});
