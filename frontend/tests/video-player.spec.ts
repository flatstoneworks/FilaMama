import { test, expect } from '@playwright/test';

test.describe('Video Player', () => {
  test('vertical video has correct layout', async ({ page }) => {
    // Use WebM for headless Chromium compatibility
    await page.goto('http://spark.local:8010/view/Downloads/drive/vertical_output.webm');
    
    // Wait for video to load
    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 10000 });
    
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2;
    }, { timeout: 15000 });
    
    // Verify video dimensions
    const state = await video.evaluate((v: HTMLVideoElement) => ({
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      isVertical: v.videoHeight > v.videoWidth,
    }));
    
    expect(state.isVertical).toBe(true);
    expect(state.videoWidth).toBe(608);
    expect(state.videoHeight).toBe(1080);
  });

  test('video controls are visible', async ({ page }) => {
    await page.goto('http://spark.local:8010/view/Downloads/drive/vertical_output.webm');
    
    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 10000 });
    
    // Check for play button
    const playButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(playButton).toBeVisible();
    
    // Check for time display
    await expect(page.locator('text=/\\d+:\\d+/')).toBeVisible();
  });

  test('keyboard shortcuts work', async ({ page }) => {
    await page.goto('http://spark.local:8010/view/Downloads/drive/vertical_output.webm');
    
    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 10000 });
    
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2;
    }, { timeout: 15000 });
    
    // Test play/pause with Space
    const initialPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const afterSpace = await video.evaluate((v: HTMLVideoElement) => v.paused);
    expect(afterSpace).not.toBe(initialPaused);
    
    // Test seek with L key
    const timeBefore = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.keyboard.press('l');
    await page.waitForTimeout(300);
    const timeAfter = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(timeAfter).toBeGreaterThan(timeBefore);
  });
});
