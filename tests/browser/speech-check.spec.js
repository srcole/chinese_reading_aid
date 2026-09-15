import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const synth = new EventTarget();
    synth.getVoices = () => [{ voiceURI: 'device', name: 'Device Mandarin', lang: 'zh-CN', localService: true }];
    synth.cancel = () => {};
    synth.speak = utterance => {
      window.testUtterance = utterance;
      // English works; Mandarin intentionally never emits a start event.
      if (utterance.lang === 'en-US') {
        utterance.dispatchEvent(new Event('start'));
        utterance.dispatchEvent(new Event('end'));
      }
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class extends EventTarget { constructor(text) { super(); this.text = text; } } });
    localStorage.setItem('slowly-draft', JSON.stringify({ chinese: 'PRIVATE PASSAGE', english: 'PRIVATE TRANSLATION' }));
  });
  await page.goto('/speech-check.html');
});

test('voice check isolates native failure and produces a passage-free report', async ({ page }) => {
  await page.clock.install();
  await page.getByLabel('Mandarin voice').selectOption('device');
  await page.getByRole('button', { name: 'Test Mandarin:' }).click();
  await expect(page.getByRole('button', { name: 'Test default English' })).toBeDisabled();
  await page.clock.runFor(15000);
  await expect(page.locator('#result')).toContainText('direct browser test did not start');
  await expect(page.locator('#report')).toContainText('timeout');
  await expect(page.locator('#report')).not.toContainText('PRIVATE');
  await page.getByRole('button', { name: 'Test default English' }).click();
  await expect(page.locator('#result')).toContainText('test completed');
  await expect(page.locator('#report')).toContainText('en-US');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('stopping a diagnostic test ignores stale events and timeout', async ({ page }) => {
  await page.clock.install();
  await page.getByRole('button', { name: 'Test Mandarin:' }).click();
  await page.getByRole('button', { name: 'Stop test' }).click();
  await page.evaluate(() => window.testUtterance.dispatchEvent(new Event('end')));
  await page.clock.runFor(15000);
  await expect(page.locator('#result')).toContainText('Stopped.');
  await expect(page.locator('#report')).not.toContainText('timeout');
});
