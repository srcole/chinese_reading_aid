import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const synth = new EventTarget();
    synth.getVoices = () => [
      { voiceURI: 'test', name: 'Test Mandarin', lang: 'zh-CN', localService: true },
      { voiceURI: 'google', name: 'Google 普通话', lang: 'zh-CN', localService: false },
    ];
    let cancelledUntil = 0;
    synth.cancel = () => { cancelledUntil = Date.now() + 100; };
    synth.resume = () => {};
    synth.speak = utterance => {
      window.currentUtterance = utterance;
      // Reproduce a silent voice and an engine that needs cancellation to settle.
      if (Date.now() < cancelledUntil || utterance.voice?.voiceURI === 'google') return;
      utterance.onstart();
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
  });
  await page.goto('/');
});

test('silent Google voice times out and reset recovers with a device voice', async ({ page }) => {
  await page.clock.install();
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Read from line 2:' }).click();
  await expect(page.locator('#status')).toHaveText('Reading line 2 of 4');
  await page.getByLabel('Mandarin voice').selectOption('google');
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled();
  await expect(page.locator('#status')).toContainText('tap Resume');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(200);
  await expect(page.locator('#status')).toHaveText('Starting line 2 of 4');
  await page.clock.runFor(8000);
  await expect(page.locator('#status')).toContainText('did not start');
  await page.getByRole('button', { name: 'Reset audio', exact: true }).click();
  await expect(page.getByLabel('Mandarin voice')).toHaveValue('test');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(200);
  await expect(page.locator('#status')).toHaveText('Reading line 2 of 4');
  await page.evaluate(() => window.currentUtterance.onend());
  await expect(page.locator('#status')).toHaveText('Reading line 3 of 4');
});

test('example, playback, jump, pause, stop, and saved corrections', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.locator('.reading-card')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
  await page.getByRole('button', { name: 'Read from start' }).click();
  await expect(page.locator('.reading-card').nth(0)).toHaveClass(/active/);
  await page.evaluate(() => window.currentUtterance.onend());
  await expect(page.locator('.reading-card').nth(1)).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Read from line 3:' }).click();
  await expect(page.locator('#status')).toHaveText('Reading line 3 of 4');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Paused at line 3 of 4');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Reading line 3 of 4');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.reading-card.active')).toHaveCount(0);
  await page.getByLabel('English for line 1', { exact: true }).fill('My edited translation');
  await page.getByLabel('Pinyin for line 1', { exact: true }).fill('màn màn lái');
  await page.reload();
  await expect(page.getByLabel('English for line 1', { exact: true })).toHaveValue('My edited translation');
  await expect(page.getByLabel('Pinyin for line 1', { exact: true })).toHaveValue('màn màn lái');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('alignment, traditional input, and safe text rendering', async ({ page }) => {
  await page.getByLabel('Chinese text').fill('學習中文。你好！');
  await page.locator('#english').fill('Learn Chinese\nHello\nExtra');
  await expect(page.getByRole('button', { name: 'Prepare reading' })).toBeDisabled();
  await page.locator('#english').fill('Learn Chinese\n<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Prepare reading' }).click();
  await expect(page.locator('.reading-card')).toHaveCount(2);
  await expect(page.getByLabel('Pinyin for line 1', { exact: true })).toHaveValue(/xué xí zhōng wén/);
  await expect(page.locator('#cards img')).toHaveCount(0);
  await page.getByLabel('Split into').selectOption('newlines');
  await expect(page.getByRole('button', { name: 'Prepare reading' })).toBeDisabled();
  await page.locator('#english').fill('Learn Chinese. Hello!');
  await page.getByRole('button', { name: 'Prepare reading' }).click();
  await expect(page.locator('.reading-card')).toHaveCount(1);
});

test('pasted English paragraph matches sentences; manual mode and saved edits are respected', async ({ page }) => {
  await page.getByLabel('Chinese text').fill('你好。你好吗？我很好！');
  await page.locator('#english').fill('Hello. How are you? I am fine!');
  await page.getByText('Preview line matching').click();
  await expect(page.locator('#alignment li small')).toHaveText(['Hello.', 'How are you?', 'I am fine!']);
  await page.getByRole('button', { name: 'Prepare reading' }).click();
  await expect(page.getByLabel('English for line 2', { exact: true })).toHaveValue('How are you?');
  await page.getByLabel('Match English by').selectOption('newlines');
  await expect(page.locator('#alignment li small').first()).toHaveText('Hello. How are you? I am fine!');
  await page.reload();
  await expect(page.getByLabel('Match English by')).toHaveValue('newlines');
  await expect(page.getByLabel('English for line 2', { exact: true })).toHaveValue('How are you?');
  await page.getByLabel('Match English by').selectOption('auto');
  await page.locator('#english').fill('Hello. Welcome!\nHow are you?\nI am fine!');
  await expect(page.locator('#alignment li small').first()).toHaveText('Hello. Welcome!');
});
